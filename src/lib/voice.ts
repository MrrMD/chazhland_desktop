import { Room, RoomEvent, Track, AudioPresets, ScreenSharePresets, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant, type Participant, type LocalAudioTrack, type AudioCaptureOptions, type ScreenShareCaptureOptions, type TrackPublishOptions, type VideoPreset } from 'livekit-client'
import { createRnnoiseProcessor, RNNOISE_PROCESSOR_NAME } from './rnnoise'
import { MOCK } from './config'
import { api } from './api'
import { sfx } from './sfx'
import { soundboard } from './soundboard'

export interface VoiceParticipant { id: string; name: string; speaking: boolean; micOn: boolean; deafened: boolean; volume: number }
export interface ScreenShare { id: string; track: RemoteTrack; by: string; userId: string }
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
// верхняя граница шкалы уровня микрофона (RMS): громкая речь ≈0.15..0.3. Слайдер порога 0..1 и
// индикатор уровня используют один масштаб, чтобы метка и полоска совпадали визуально.
export const MIC_RMS_FULL = 0.3
export interface VoiceSettings {
  inputId: string   // '' = устройство по умолчанию
  outputId: string  // '' = по умолчанию
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  mode: VoiceMode
  pttKey: string    // KeyboardEvent.code, напр. 'Space'
  micThreshold: number         // 0..1, порог голосовой активации; 0 = гейт выключен
  soundboardMuted: boolean     // приглушить саундпад ОТ ДРУГИХ лично у себя
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
  screenTrack: RemoteTrack | null   // активная (показываемая) демонстрация
  screenBy: string | null
  screens: ScreenShare[]            // все идущие демонстрации в канале (для переключения)
  activeScreenId: string | null
}
export interface AudioDevice { id: string; label: string }

const INITIAL: VoiceState = {
  channelId: null, channelName: null, connecting: false,
  micOn: false, deafened: false, screenOn: false, participants: [], screenTrack: null, screenBy: null,
  screens: [], activeScreenId: null,
}
const LS = 'chazh.voice'
const LS_VOL = 'chazh.voice.vol' // персональная громкость собеседников: identity -> множитель (0..2)
const DEFAULTS: VoiceSettings = { inputId: '', outputId: '', noiseSuppression: true, echoCancellation: true, autoGain: true, mode: 'voice', pttKey: 'Space', micThreshold: 0, soundboardMuted: false, screenQuality: 'q720', screenAudio: false }
// глобальный хоткей тумблера микрофона (работает вне фокуса окна; true hold-PTT недоступен через globalShortcut)
const MIC_HOTKEY = 'CommandOrControl+Shift+M'
const SB_TRACK_NAME = 'soundboard' // имя публикуемого аудио-трека саундпада (отличаем на приёмнике от голоса)

class Voice {
  private room: Room | null = null
  private audioEls = new Map<RemoteTrack, HTMLAudioElement>()
  private soundboardEls = new Map<RemoteTrack, HTMLAudioElement>() // входящие треки саундпада (мутятся отдельно)
  private screenTracks = new Map<RemoteTrack, { userId: string; name: string }>()
  private screenIds = new WeakMap<RemoteTrack, string>() // стабильный id на трек (для выбора активной демонстрации)
  private screenIdSeq = 0
  private activeScreenId: string | null = null
  private speaking = new Set<string>()
  private targetId: string | null = null
  private joinSeq = 0
  private screenSeq = 0 // инвалидация in-flight операций демонстрации (стоп/смена качества/комнаты)
  private micBeforeDeaf = true
  private pttHeld = false
  private micChain: Promise<void> = Promise.resolve() // очередь операций с микрофоном (анти-гонка)
  // голосовой гейт (порог реагирования микрофона): замеряем уровень с клона трека, публикуемый трек
  // глушим/открываем через mediaStreamTrack.enabled (дёшево, без пере-согласования)
  private gateCtx: AudioContext | null = null
  private gateAnalyser: AnalyserNode | null = null
  private gateMeasure: MediaStreamTrack | null = null
  private gateBuf: Float32Array<ArrayBuffer> | null = null
  private gateRaf: number | null = null
  private gateHoldUntil = 0
  private volumes = this.loadVolumes()
  state: VoiceState = { ...INITIAL }
  settings: VoiceSettings = this.load()
  private cbs = new Set<(s: VoiceState) => void>()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKey(e, true))
      window.addEventListener('keyup', (e) => this.onKey(e, false))
      // PTT по кнопке мыши (боковые/средняя): срабатывает, пока окно в фокусе
      window.addEventListener('mousedown', (e) => this.onMouse(e, true))
      window.addEventListener('mouseup', (e) => this.onMouse(e, false))
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
        participants: [{ id: 'u_anya', name: 'Аня', speaking: true, micOn: true, deafened: false, volume: 1 }, { id: 'u_me', name: 'Вы', speaking: false, micOn: true, deafened: false, volume: 1 }] })
      return
    }

    // screenTrack/screenBy сбрасываем явно: иначе чужая демонстрация из прошлого канала
    // осталась бы висеть (teardownRoom лишь чистит карту треков, но не трогает state)
    this.set({ channelId, channelName, connecting: true, micOn: false, deafened: false, screenOn: false, participants: [], screenTrack: null, screenBy: null, screens: [], activeScreenId: null })
    try {
      const t = await api.livekitToken(channelId)
      if (this.joinSeq !== seq) return
      // musicHighQuality (≈96 кбит/с mono) + RED: голос собеседника звучит чище и устойчивее к
      // потерям пакетов, в т.ч. когда говорят одновременно; речевой пресет по умолчанию режет качество
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: this.captureOpts(),
        publishDefaults: { audioPreset: AudioPresets.musicHighQuality, red: true, dtx: true } })
      this.room = room
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => this.attach(track, pub, p))
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => this.detach(track))
        .on(RoomEvent.ActiveSpeakersChanged, (sp: Participant[]) => { this.speaking = new Set(sp.map((p) => p.identity)); this.refresh() })
        .on(RoomEvent.ParticipantAttributesChanged, () => this.refresh()) // чужой deafen приходит атрибутом
        .on(RoomEvent.ParticipantConnected, () => { sfx.join(); this.refresh() })
        .on(RoomEvent.ParticipantDisconnected, () => { sfx.leave(); this.refresh() })
        .on(RoomEvent.LocalTrackPublished, () => this.refresh())
        .on(RoomEvent.Disconnected, () => { if (this.room === room) { this.stopMicGate(false); this.targetId = null; this.room = null; window.chazh?.setMicHotkey(null); this.set({ ...INITIAL }) } })
      await room.connect(t.url, t.token)
      if (this.joinSeq !== seq) { room.removeAllListeners(); try { await room.disconnect() } catch { /* */ } return }
      if (this.settings.outputId) await room.switchActiveDevice('audiooutput', this.settings.outputId).catch(() => {})
      const micOn = this.settings.mode === 'voice' // в режиме PTT молчим до нажатия клавиши
      if (micOn) { await room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()); await this.refreshMicProcessor() }
      // саундпад: публикуем отдельный аудио-трек, в который микшируются клипы (слышат все). Публикуем КЛОН —
      // чтобы LiveKit, остановив трек при выходе из канала, не заглушил наш постоянный микшер.
      try {
        const sb = soundboard.outputTrack()
        if (sb && this.joinSeq === seq && this.room === room) {
          await room.localParticipant.publishTrack(sb.clone(), { name: SB_TRACK_NAME, source: Track.Source.Unknown })
        }
      } catch { /* саундпад недоступен — голос работает */ }
      this.set({ connecting: false, micOn })
      // только если это всё ещё актуальное соединение — иначе Disconnected уже снял хоткей, не возвращаем его
      if (this.joinSeq === seq && this.room === room) window.chazh?.setMicHotkey(MIC_HOTKEY)
      this.refresh()
    } catch {
      if (this.joinSeq === seq) { this.targetId = null; await this.teardownRoom(); this.set({ ...INITIAL }) }
    }
  }

  private attach(track: RemoteTrack, pub: RemoteTrackPublication | undefined, participant: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const isSb = pub?.trackName === SB_TRACK_NAME // саундпад приходит отдельным аудио-треком
      const el = track.attach() as HTMLAudioElement
      el.muted = this.state.deafened || (isSb && this.settings.soundboardMuted)
      el.autoplay = true
      if (this.settings.outputId && 'setSinkId' in el) (el as any).setSinkId(this.settings.outputId).catch(() => {})
      document.body.appendChild(el)
      if (isSb) {
        this.soundboardEls.set(track, el)
      } else {
        this.audioEls.set(track, el)
        const vol = this.volumes.get(participant.identity) // восстановить персональную громкость собеседника
        if (vol != null && vol !== 1) participant.setVolume(vol)
      }
    } else if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
      this.screenTracks.set(track, { userId: participant.identity, name: participant.name || '' })
      this.syncScreen()
    }
    this.refresh()
  }
  private detach(track: RemoteTrack) {
    track.detach().forEach((el) => el.remove())
    this.audioEls.delete(track)
    this.soundboardEls.delete(track)
    if (this.screenTracks.delete(track)) this.syncScreen()
    this.refresh()
  }
  private screenKey(track: RemoteTrack): string {
    let id = this.screenIds.get(track)
    if (!id) { id = 's' + (++this.screenIdSeq); this.screenIds.set(track, id) }
    return id
  }
  private syncScreen() {
    const screens: ScreenShare[] = []
    this.screenTracks.forEach((info, track) => screens.push({ id: this.screenKey(track), track, by: info.name || info.userId, userId: info.userId }))
    // активной остаётся та же демонстрация, если она ещё идёт; иначе — первая в списке
    const active = screens.find((s) => s.id === this.activeScreenId) ?? screens[0] ?? null
    this.activeScreenId = active ? active.id : null
    this.set({ screens, screenTrack: active ? active.track : null, screenBy: active ? active.by : null, activeScreenId: this.activeScreenId })
  }
  // переключение между несколькими демонстрациями в канале (UI вызывает по клику на пилюлю)
  setActiveScreen(id: string) {
    if (!this.screenTracks.size) return
    this.activeScreenId = id
    this.syncScreen()
  }

  private refresh() {
    if (!this.room) return
    const lp = this.room.localParticipant
    const parts: VoiceParticipant[] = [
      // своё «оглушён» знаем напрямую из state (надёжнее, чем читать собственный атрибут)
      { id: lp.identity, name: lp.name || 'Вы', speaking: this.speaking.has(lp.identity), micOn: lp.isMicrophoneEnabled, deafened: this.state.deafened, volume: 1 },
    ]
    this.room.remoteParticipants.forEach((p: RemoteParticipant) =>
      parts.push({ id: p.identity, name: p.name || p.identity, speaking: this.speaking.has(p.identity), micOn: p.isMicrophoneEnabled, deafened: p.attributes?.['deaf'] === '1', volume: this.volumes.get(p.identity) ?? 1 }))
    this.set({ participants: parts })
  }

  // Применение состояния микрофона через очередь: при быстрых повторных нажатиях мьюта раньше
  // накладывались друг на друга await setMicrophoneEnabled → реальное состояние трека рассинхронизировалось
  // с UI («ломался мут»). Теперь операции строго упорядочены, а нет-оп при совпадении состояния пропускается.
  private applyMic(on: boolean): Promise<void> {
    this.micChain = this.micChain.then(async () => {
      if (MOCK || !this.room) return
      const lp = this.room.localParticipant
      if (lp.isMicrophoneEnabled !== on) await lp.setMicrophoneEnabled(on, this.captureOpts()).catch(() => {})
      if (on) await this.refreshMicProcessor()
      this.syncMicGate() // запустить/остановить голосовой гейт под новое состояние микрофона
    })
    return this.micChain
  }

  async toggleMic() {
    const on = !this.state.micOn
    this.set({ micOn: on }) // синхронно: следующее нажатие читает уже новое значение, клики не «склеиваются»
    on ? sfx.micOn() : sfx.micOff()
    await this.applyMic(on)
    this.refresh() // сверяем индикаторы с фактическим состоянием трека после применения очереди
  }
  async toggleDeaf() {
    const d = !this.state.deafened
    let micOn: boolean
    if (d) { this.micBeforeDeaf = this.state.micOn; micOn = false }
    else { micOn = this.micBeforeDeaf }
    this.set({ deafened: d, micOn }) // синхронно: UI + собственный deafened, который читает refresh()
    this.applyMutes() // оглушение глушит и голос собеседников, и саундпад
    d ? sfx.deafOn() : sfx.deafOff()
    if (!MOCK && this.room) {
      this.room.localParticipant.setAttributes({ deaf: d ? '1' : '0' }).catch(() => {}) // транслируем остальным
      await this.applyMic(micOn) // оглушение гасит и микрофон — через ту же очередь, что и тумблер мьюта
    }
    this.refresh() // обновить индикаторы своей строки (наушники/микрофон)
  }

  // единая точка мута входящего звука: оглушение глушит всё; саундпад дополнительно — по личной настройке
  private applyMutes() {
    const d = this.state.deafened
    this.audioEls.forEach((el) => { el.muted = d })
    this.soundboardEls.forEach((el) => { el.muted = d || this.settings.soundboardMuted })
  }
  setSoundboardMuted(on: boolean) {
    this.settings.soundboardMuted = on
    this.saveSettings()
    this.applyMutes()
  }

  async toggleScreen() {
    const on = !this.state.screenOn
    if (MOCK) { on ? sfx.screenOn() : sfx.screenOff(); return this.set({ screenOn: on }) }
    if (!this.room) return
    const room = this.room
    const seq = ++this.screenSeq
    if (!on) {
      try { await room.localParticipant.setScreenShareEnabled(false) } catch { /* */ }
      sfx.screenOff()
      return this.set({ screenOn: false })
    }
    try {
      // ВАЖНО: ждём, пока main выставит shareSystemAudio, ДО getDisplayMedia — иначе обработчик
      // setDisplayMediaRequestHandler прочитает старое значение и не подмешает loopback (баг звука демонстрации)
      await window.chazh?.setShareAudio(this.settings.screenAudio) // системный звук отдаёт main (loopback)
      const { capture, publish } = this.screenOpts()
      await room.localParticipant.setScreenShareEnabled(true, capture, publish)
      // пока выбирали источник, пользователь мог остановить/сменить канал — гасим висящий трек
      if (this.screenSeq !== seq || this.room !== room) {
        try { await room.localParticipant.setScreenShareEnabled(false) } catch { /* */ }
        return
      }
      this.set({ screenOn: true })
      sfx.screenOn()
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
      await window.chazh?.setShareAudio(this.settings.screenAudio) // ждём main до getDisplayMedia (loopback не подмешается раньше времени)
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
      this.stopMicGate(false); this.syncMicGate() // трек пересоздан — пересобираем клон-замер гейта
    }
  }
  async setMode(mode: VoiceMode) {
    this.settings.mode = mode; this.saveSettings()
    if (!this.room) return
    if (mode === 'ptt') { await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); this.set({ micOn: false }) }
    else if (!this.state.deafened) { await this.room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()).catch(() => {}); await this.refreshMicProcessor(); this.set({ micOn: true }) }
    this.syncMicGate() // PTT отключает гейт, голосовая активация — включает (если задан порог)
  }
  setPttKey(code: string) { this.settings.pttKey = code; this.saveSettings() }

  // Нейросетевой шумодав RNNoise поверх браузерного NS — давит стук клавиш/мыши, которые браузерный
  // noiseSuppression пропускает. ПОЛНОСТЬЮ клиентский (Web Audio + WASM), без сервера/лицензии — в отличие
  // от Krisp, которому нужен LiveKit Cloud (на self-host он давал 404). Тумблер «Шумоподавление» управляет
  // им; при ошибке тихо откатываемся на браузерный NS из captureOpts().
  private async refreshMicProcessor() {
    if (MOCK || !this.room) return
    const track = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined
    if (!track) return
    const want = this.settings.noiseSuppression
    const has = track.getProcessor()?.name === RNNOISE_PROCESSOR_NAME
    if (want === has) return // уже в нужном состоянии — НЕ пересоздаём процессор. Критично для PTT:
                             // трек переживает mute, поэтому каждое нажатие иначе грузило бы WASM-модель заново
    try {
      if (want) await track.setProcessor(createRnnoiseProcessor())
      else await track.stopProcessor()
    } catch { /* RNNoise недоступен — остаётся браузерный noiseSuppression */ }
  }

  // ---- голосовой гейт (порог реагирования микрофона) ----
  private micTrackSource(): MediaStreamTrack | undefined {
    return (this.room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined)?.mediaStreamTrack
  }
  // запустить/остановить гейт под текущее состояние (вызывается из applyMic/setMode/setMicThreshold)
  private syncMicGate() {
    const micOnVoice = !MOCK && !!this.room && this.state.micOn && this.settings.mode === 'voice'
    if (micOnVoice && this.settings.micThreshold > 0) this.startMicGate()
    else this.stopMicGate(micOnVoice) // микрофон включён, но гейт выкл → вернуть звук; выключен (мьют) → не трогать enabled
  }
  private startMicGate() {
    if (this.gateRaf != null) return // уже работает
    const src = this.micTrackSource()
    if (!src) return
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      const measure = src.clone() // отдельный трек для замера: гашение публикуемого трека его не глушит
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(new MediaStream([measure])).connect(analyser)
      this.gateCtx = ctx; this.gateAnalyser = analyser; this.gateMeasure = measure
      this.gateBuf = new Float32Array(analyser.fftSize)
      const HOLD = 250 // мс «дотянуть» после спада уровня — чтобы хвосты слов не обрезались
      const loop = () => {
        const a = this.gateAnalyser, buf = this.gateBuf, t = this.micTrackSource()
        if (!a || !buf || !t) { this.gateRaf = null; return }
        a.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        const rms = Math.sqrt(sum / buf.length)
        const now = performance.now()
        if (rms >= this.settings.micThreshold * MIC_RMS_FULL) this.gateHoldUntil = now + HOLD
        const open = now < this.gateHoldUntil
        if (t.enabled !== open) t.enabled = open
        this.gateRaf = requestAnimationFrame(loop)
      }
      this.gateRaf = requestAnimationFrame(loop)
    } catch { this.stopMicGate(true) }
  }
  private stopMicGate(reopen: boolean) {
    if (this.gateRaf != null) { cancelAnimationFrame(this.gateRaf); this.gateRaf = null }
    if (this.gateMeasure) { try { this.gateMeasure.stop() } catch { /* */ } this.gateMeasure = null }
    if (this.gateCtx) { try { void this.gateCtx.close() } catch { /* */ } this.gateCtx = null }
    this.gateAnalyser = null; this.gateBuf = null
    if (reopen) { const t = this.micTrackSource(); if (t && !t.enabled) t.enabled = true } // вернуть звук, если гейт его приглушил
  }
  async setMicThreshold(v: number) {
    this.settings.micThreshold = Math.max(0, Math.min(1, v)); this.saveSettings()
    this.syncMicGate() // пересечение 0↔>0 запускает/останавливает гейт; иначе он сам читает новое значение
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
    e.preventDefault()
    await this.pttApply(down)
  }

  // PTT по кнопке мыши: pttKey вида 'Mouse<button>' (1 — средняя, 2 — правая, 3/4 — боковые)
  private async onMouse(e: MouseEvent, down: boolean) {
    if (this.settings.mode !== 'ptt' || !this.room || MOCK) return
    if (this.settings.pttKey !== 'Mouse' + e.button) return
    e.preventDefault() // для боковых кнопок заодно гасим навигацию назад/вперёд
    await this.pttApply(down)
  }

  // общее применение PTT (клавиша/мышь): дребезг гасим pttHeld, микрофон — через ту же очередь, что и мьют
  private async pttApply(down: boolean) {
    if (down === this.pttHeld) return
    this.pttHeld = down
    this.set({ micOn: down })
    await this.applyMic(down)
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
    this.stopMicGate(false)
    this.audioEls.forEach((el) => el.remove())
    this.audioEls.clear()
    this.soundboardEls.forEach((el) => el.remove())
    this.soundboardEls.clear()
    this.screenTracks.clear()
    this.activeScreenId = null
    this.speaking.clear()
    this.pttHeld = false
    const r = this.room
    this.room = null
    if (r) { r.removeAllListeners(); try { await r.disconnect() } catch { /* */ } }
  }
}

export const voice = new Voice()
