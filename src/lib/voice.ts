import { Room, RoomEvent, Track, AudioPresets, ScreenSharePresets, type RemoteTrack, type RemoteParticipant, type Participant, type LocalAudioTrack, type AudioCaptureOptions, type ScreenShareCaptureOptions, type TrackPublishOptions, type VideoPreset } from 'livekit-client'
import { KrispNoiseFilter, isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter'
import { MOCK } from './config'
import { api } from './api'

export interface VoiceParticipant { id: string; name: string; speaking: boolean; micOn: boolean; volume: number }
export type VoiceMode = 'voice' | 'ptt'

// Качество демонстрации экрана: пресеты LiveKit + «Исходное» (нативное разрешение, высокий битрейт).
export type ScreenQuality = 'source' | 'q1080' | 'q720' | 'q360'
const SCREEN_PRESETS: Record<ScreenQuality, VideoPreset> = {
  source: ScreenSharePresets.original,
  q1080: ScreenSharePresets.h1080fps30,
  q720: ScreenSharePresets.h720fps30,
  q360: ScreenSharePresets.h360fps15,
}
export const SCREEN_QUALITY_LABELS: Record<ScreenQuality, string> = {
  source: 'Исходное', q1080: '1080p · 30', q720: '720p · 30', q360: 'Экономно · 360p',
}
export const SCREEN_QUALITY_ORDER: ScreenQuality[] = ['source', 'q1080', 'q720', 'q360']
export interface VoiceSettings {
  inputId: string   // '' = устройство по умолчанию
  outputId: string  // '' = по умолчанию
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  mode: VoiceMode
  pttKey: string    // KeyboardEvent.code, напр. 'Space'
  screenQuality: ScreenQuality // качество демонстрации экрана
  screenAudio: boolean         // транслировать системный звук при демонстрации
}
export interface VoiceState {
  channelId: string | null
  channelName: string | null
  connecting: boolean
  micOn: boolean
  deafened: boolean
  screenOn: boolean
  participants: VoiceParticipant[]
  screenTrack: RemoteTrack | null
  screenBy: string | null
}
export interface AudioDevice { id: string; label: string }

const INITIAL: VoiceState = {
  channelId: null, channelName: null, connecting: false,
  micOn: false, deafened: false, screenOn: false, participants: [], screenTrack: null, screenBy: null,
}
const LS = 'chazh.voice'
const LS_VOL = 'chazh.voice.vol' // персональная громкость собеседников: identity -> множитель (0..2)
const DEFAULTS: VoiceSettings = { inputId: '', outputId: '', noiseSuppression: true, echoCancellation: true, autoGain: true, mode: 'voice', pttKey: 'Space', screenQuality: 'q720', screenAudio: false }
// глобальный хоткей тумблера микрофона (работает вне фокуса окна; true hold-PTT недоступен через globalShortcut)
const MIC_HOTKEY = 'CommandOrControl+Shift+M'

class Voice {
  private room: Room | null = null
  private audioEls = new Map<RemoteTrack, HTMLAudioElement>()
  private screenTracks = new Map<RemoteTrack, string>()
  private speaking = new Set<string>()
  private targetId: string | null = null
  private joinSeq = 0
  private screenSeq = 0 // инвалидация in-flight операций демонстрации (стоп/смена качества/комнаты)
  private micBeforeDeaf = true
  private pttHeld = false
  private volumes = this.loadVolumes()
  state: VoiceState = { ...INITIAL }
  settings: VoiceSettings = this.load()
  private cbs = new Set<(s: VoiceState) => void>()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKey(e, true))
      window.addEventListener('keyup', (e) => this.onKey(e, false))
      window.chazh?.onToggleMic(() => { void this.toggleMic() }) // глобальный хоткей → тумблер микрофона
    }
  }

  private load(): VoiceSettings {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') } } catch { return { ...DEFAULTS } }
  }
  private saveSettings() { localStorage.setItem(LS, JSON.stringify(this.settings)) }
  private loadVolumes(): Map<string, number> {
    try { return new Map(Object.entries(JSON.parse(localStorage.getItem(LS_VOL) || '{}')) as [string, number][]) } catch { return new Map() }
  }
  private saveVolumes() { localStorage.setItem(LS_VOL, JSON.stringify(Object.fromEntries(this.volumes))) }

  subscribe(cb: (s: VoiceState) => void): () => void {
    this.cbs.add(cb); cb(this.state)
    return () => { this.cbs.delete(cb) }
  }
  private set(p: Partial<VoiceState>) { this.state = { ...this.state, ...p }; this.cbs.forEach((c) => c(this.state)) }

  private captureOpts(): AudioCaptureOptions {
    return {
      deviceId: this.settings.inputId || undefined,
      noiseSuppression: this.settings.noiseSuppression,
      echoCancellation: this.settings.echoCancellation,
      autoGainControl: this.settings.autoGain,
    }
  }

  async join(channelId: string, channelName: string) {
    if (this.targetId === channelId) return
    this.targetId = channelId
    const seq = ++this.joinSeq
    await this.teardownRoom()
    if (this.joinSeq !== seq) return

    if (MOCK) {
      this.set({ channelId, channelName, connecting: false, micOn: this.settings.mode === 'voice', deafened: false, screenOn: false,
        participants: [{ id: 'u_anya', name: 'Аня', speaking: true, micOn: true, volume: 1 }, { id: 'u_me', name: 'Вы', speaking: false, micOn: true, volume: 1 }] })
      return
    }

    // screenTrack/screenBy сбрасываем явно: иначе чужая демонстрация из прошлого канала
    // осталась бы висеть (teardownRoom лишь чистит карту треков, но не трогает state)
    this.set({ channelId, channelName, connecting: true, micOn: false, deafened: false, screenOn: false, participants: [], screenTrack: null, screenBy: null })
    try {
      const t = await api.livekitToken(channelId)
      if (this.joinSeq !== seq) return
      // musicHighQuality (≈96 кбит/с mono) + RED: голос собеседника звучит чище и устойчивее к
      // потерям пакетов, в т.ч. когда говорят одновременно; речевой пресет по умолчанию режет качество
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: this.captureOpts(),
        publishDefaults: { audioPreset: AudioPresets.musicHighQuality, red: true, dtx: true } })
      this.room = room
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => this.attach(track, p))
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => this.detach(track))
        .on(RoomEvent.ActiveSpeakersChanged, (sp: Participant[]) => { this.speaking = new Set(sp.map((p) => p.identity)); this.refresh() })
        .on(RoomEvent.ParticipantConnected, () => this.refresh())
        .on(RoomEvent.ParticipantDisconnected, () => this.refresh())
        .on(RoomEvent.LocalTrackPublished, () => this.refresh())
        .on(RoomEvent.Disconnected, () => { if (this.room === room) { this.targetId = null; this.room = null; window.chazh?.setMicHotkey(null); this.set({ ...INITIAL }) } })
      await room.connect(t.url, t.token)
      if (this.joinSeq !== seq) { room.removeAllListeners(); try { await room.disconnect() } catch { /* */ } return }
      if (this.settings.outputId) await room.switchActiveDevice('audiooutput', this.settings.outputId).catch(() => {})
      const micOn = this.settings.mode === 'voice' // в режиме PTT молчим до нажатия клавиши
      if (micOn) { await room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()); await this.refreshMicProcessor() }
      this.set({ connecting: false, micOn })
      // только если это всё ещё актуальное соединение — иначе Disconnected уже снял хоткей, не возвращаем его
      if (this.joinSeq === seq && this.room === room) window.chazh?.setMicHotkey(MIC_HOTKEY)
      this.refresh()
    } catch {
      if (this.joinSeq === seq) { this.targetId = null; await this.teardownRoom(); this.set({ ...INITIAL }) }
    }
  }

  private attach(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach() as HTMLAudioElement
      el.muted = this.state.deafened
      el.autoplay = true
      if (this.settings.outputId && 'setSinkId' in el) (el as any).setSinkId(this.settings.outputId).catch(() => {})
      document.body.appendChild(el)
      this.audioEls.set(track, el)
      const vol = this.volumes.get(participant.identity) // восстановить персональную громкость собеседника
      if (vol != null && vol !== 1) participant.setVolume(vol)
    } else if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
      this.screenTracks.set(track, participant.name || participant.identity)
      this.syncScreen()
    }
    this.refresh()
  }
  private detach(track: RemoteTrack) {
    track.detach().forEach((el) => el.remove())
    this.audioEls.delete(track)
    if (this.screenTracks.delete(track)) this.syncScreen()
    this.refresh()
  }
  private syncScreen() {
    const first = this.screenTracks.entries().next().value as [RemoteTrack, string] | undefined
    this.set({ screenTrack: first ? first[0] : null, screenBy: first ? first[1] : null })
  }

  private refresh() {
    if (!this.room) return
    const lp = this.room.localParticipant
    const parts: VoiceParticipant[] = [
      { id: lp.identity, name: lp.name || 'Вы', speaking: this.speaking.has(lp.identity), micOn: lp.isMicrophoneEnabled, volume: 1 },
    ]
    this.room.remoteParticipants.forEach((p: RemoteParticipant) =>
      parts.push({ id: p.identity, name: p.name || p.identity, speaking: this.speaking.has(p.identity), micOn: p.isMicrophoneEnabled, volume: this.volumes.get(p.identity) ?? 1 }))
    this.set({ participants: parts })
  }

  async toggleMic() {
    const on = !this.state.micOn
    if (!MOCK && this.room) {
      await this.room.localParticipant.setMicrophoneEnabled(on, this.captureOpts()).catch(() => {})
      if (on) await this.refreshMicProcessor()
    }
    this.set({ micOn: on })
    this.refresh()
  }
  async toggleDeaf() {
    const d = !this.state.deafened
    this.audioEls.forEach((el) => { el.muted = d })
    let micOn: boolean
    if (d) { this.micBeforeDeaf = this.state.micOn; micOn = false }
    else { micOn = this.micBeforeDeaf }
    if (!MOCK && this.room && micOn !== this.state.micOn) {
      await this.room.localParticipant.setMicrophoneEnabled(micOn, this.captureOpts()).catch(() => {})
      if (micOn) await this.refreshMicProcessor()
    }
    this.set({ deafened: d, micOn })
  }
  async toggleScreen() {
    const on = !this.state.screenOn
    if (MOCK) return this.set({ screenOn: on })
    if (!this.room) return
    const room = this.room
    const seq = ++this.screenSeq
    if (!on) {
      try { await room.localParticipant.setScreenShareEnabled(false) } catch { /* */ }
      return this.set({ screenOn: false })
    }
    try {
      window.chazh?.setShareAudio(this.settings.screenAudio) // системный звук отдаёт main (loopback)
      const { capture, publish } = this.screenOpts()
      await room.localParticipant.setScreenShareEnabled(true, capture, publish)
      // пока выбирали источник, пользователь мог остановить/сменить канал — гасим висящий трек
      if (this.screenSeq !== seq || this.room !== room) {
        try { await room.localParticipant.setScreenShareEnabled(false) } catch { /* */ }
        return
      }
      this.set({ screenOn: true })
    } catch { /* пользователь отменил выбор источника */ }
  }

  // опции захвата/публикации демонстрации по текущему качеству; для «Исходного» разрешение не
  // ограничиваем (нативное), для остальных — берём из пресета LiveKit
  private screenOpts(): { capture: ScreenShareCaptureOptions; publish: TrackPublishOptions } {
    const preset = SCREEN_PRESETS[this.settings.screenQuality]
    // системный звук отдаётся через loopback только на Windows (см. main.ts); на macOS getDisplayMedia
    // его не возвращает — не запрашиваем, иначе constraints просят то, что не будет доставлено
    const audio = this.settings.screenAudio && window.chazh?.platform === 'win32'
    const capture: ScreenShareCaptureOptions = {
      audio,
      contentHint: 'detail',
      ...(this.settings.screenQuality === 'source' ? {} : { resolution: preset.resolution }),
    }
    return { capture, publish: { videoEncoding: preset.encoding } }
  }

  // перезапуск демонстрации с текущими настройками (смена качества/звука на лету; источник
  // Electron выбирает автоматически, поэтому повторный диалог не всплывает)
  private async restartScreen() {
    if (!this.room || !this.state.screenOn) return
    const room = this.room
    const seq = ++this.screenSeq
    try {
      await room.localParticipant.setScreenShareEnabled(false)
      // если пока перезапускали — остановили демонстрацию / сменили комнату, НЕ возобновляем (приватность)
      if (this.screenSeq !== seq || this.room !== room || !this.state.screenOn) return
      window.chazh?.setShareAudio(this.settings.screenAudio)
      const { capture, publish } = this.screenOpts()
      await room.localParticipant.setScreenShareEnabled(true, capture, publish)
      if (this.screenSeq !== seq || this.room !== room) { // отменили на финальном шаге — гасим трек
        try { await room.localParticipant.setScreenShareEnabled(false) } catch { /* */ }
      }
    } catch { if (this.screenSeq === seq) this.set({ screenOn: false }) }
  }

  getScreenSettings(): { quality: ScreenQuality; audio: boolean } {
    return { quality: this.settings.screenQuality, audio: this.settings.screenAudio }
  }
  async setScreenQuality(q: ScreenQuality) {
    this.settings.screenQuality = q; this.saveSettings()
    await this.restartScreen() // если демонстрация идёт — применяем сразу
  }
  async setScreenAudio(on: boolean) {
    this.settings.screenAudio = on; this.saveSettings()
    await this.restartScreen()
  }

  // ---- настройки ----
  async setInputDevice(id: string) {
    this.settings.inputId = id; this.saveSettings()
    if (this.room) await this.room.switchActiveDevice('audioinput', id || 'default').catch(() => {})
  }
  async setOutputDevice(id: string) {
    this.settings.outputId = id; this.saveSettings()
    if (this.room) await this.room.switchActiveDevice('audiooutput', id || 'default').catch(() => {})
    this.audioEls.forEach((el) => { if ('setSinkId' in el) (el as any).setSinkId(id || 'default').catch(() => {}) })
  }
  async setProcessing(p: Partial<Pick<VoiceSettings, 'noiseSuppression' | 'echoCancellation' | 'autoGain'>>) {
    Object.assign(this.settings, p); this.saveSettings()
    if (this.room && this.state.micOn) {
      // restartTrack пере-захватывает getUserMedia с новыми constraints. Через mute/unmute это НЕ работало
      // бы: при stopMicTrackOnMute=false трек переиспользуется и новые echoCancellation/AGC игнорируются.
      const track = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined
      if (track) await track.restartTrack(this.captureOpts()).catch(() => {})
      await this.refreshMicProcessor() // вкл./выкл. Krisp вслед за тумблером шумоподавления
    }
  }
  async setMode(mode: VoiceMode) {
    this.settings.mode = mode; this.saveSettings()
    if (!this.room) return
    if (mode === 'ptt') { await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); this.set({ micOn: false }) }
    else if (!this.state.deafened) { await this.room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()).catch(() => {}); await this.refreshMicProcessor(); this.set({ micOn: true }) }
  }
  setPttKey(code: string) { this.settings.pttKey = code; this.saveSettings() }

  // Нейросетевой шумодав Krisp поверх браузерного NS — давит стук клавиш/мыши, которые
  // браузерный noiseSuppression пропускает. Тумблер «Шумоподавление» управляет им; при
  // отсутствии поддержки/ошибке тихо откатываемся на браузерный NS из captureOpts().
  private async refreshMicProcessor() {
    if (MOCK || !this.room) return
    const track = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined
    if (!track) return
    const want = this.settings.noiseSuppression && isKrispNoiseFilterSupported()
    const has = track.getProcessor()?.name === 'livekit-noise-filter'
    if (want === has) return // уже в нужном состоянии — НЕ пересоздаём процессор. Критично для PTT:
                             // трек переживает mute, поэтому каждое нажатие иначе грузило бы WASM-модель Krisp заново
    try {
      if (want) await track.setProcessor(KrispNoiseFilter())
      else await track.stopProcessor()
    } catch { /* Krisp недоступен — остаётся браузерный noiseSuppression */ }
  }

  // ---- громкость собеседников (на стороне приёмника, у каждого своя) ----
  getParticipantVolume(userId: string): number { return this.volumes.get(userId) ?? 1 }
  setParticipantVolume(userId: string, vol: number) {
    const v = Math.max(0, Math.min(2, vol))
    if (v === 1) this.volumes.delete(userId); else this.volumes.set(userId, v) // 1 = дефолт, не храним
    this.saveVolumes()
    const p = this.room?.getParticipantByIdentity(userId)
    if (p && p !== this.room?.localParticipant) (p as RemoteParticipant).setVolume(v)
    this.refresh()
  }

  private async onKey(e: KeyboardEvent, down: boolean) {
    if (this.settings.mode !== 'ptt' || !this.room || MOCK) return
    if (e.code !== this.settings.pttKey) return
    const el = document.activeElement
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return // не перехватываем ввод текста
    if (down && e.repeat) return
    if (down === this.pttHeld) return
    this.pttHeld = down
    e.preventDefault()
    await this.room.localParticipant.setMicrophoneEnabled(down, this.captureOpts()).catch(() => {})
    if (down) await this.refreshMicProcessor()
    this.set({ micOn: down })
  }

  // Разблокировка меток устройств: enumerateDevices даёт пустые label без granted-доступа к
  // микрофону. Берём временный аудио-поток и сразу глушим — нужен только грант, не сам звук.
  async requestMicPermission(): Promise<boolean> {
    if (MOCK || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      return true
    } catch { return false }
  }

  async listDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return { inputs: [], outputs: [] }
    try {
      const devs = await navigator.mediaDevices.enumerateDevices()
      return {
        inputs: devs.filter((d) => d.kind === 'audioinput').map((d) => ({ id: d.deviceId, label: d.label || 'Микрофон' })),
        outputs: devs.filter((d) => d.kind === 'audiooutput').map((d) => ({ id: d.deviceId, label: d.label || 'Устройство вывода' })),
      }
    } catch { return { inputs: [], outputs: [] } }
  }

  async leave() {
    this.targetId = null
    this.joinSeq++
    window.chazh?.setMicHotkey(null)
    await this.teardownRoom()
    this.set({ ...INITIAL })
  }
  private async teardownRoom() {
    this.audioEls.forEach((el) => el.remove())
    this.audioEls.clear()
    this.screenTracks.clear()
    this.speaking.clear()
    this.pttHeld = false
    const r = this.room
    this.room = null
    if (r) { r.removeAllListeners(); try { await r.disconnect() } catch { /* */ } }
  }
}

export const voice = new Voice()
