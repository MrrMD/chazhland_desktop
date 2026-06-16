import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant, type Participant, type AudioCaptureOptions } from 'livekit-client'
import { MOCK } from './config'
import { api } from './api'

export interface VoiceParticipant { id: string; name: string; speaking: boolean; micOn: boolean }
export type VoiceMode = 'voice' | 'ptt'
export interface VoiceSettings {
  inputId: string   // '' = устройство по умолчанию
  outputId: string  // '' = по умолчанию
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGain: boolean
  mode: VoiceMode
  pttKey: string    // KeyboardEvent.code, напр. 'Space'
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
const DEFAULTS: VoiceSettings = { inputId: '', outputId: '', noiseSuppression: true, echoCancellation: true, autoGain: true, mode: 'voice', pttKey: 'Space' }

class Voice {
  private room: Room | null = null
  private audioEls = new Map<RemoteTrack, HTMLAudioElement>()
  private screenTracks = new Map<RemoteTrack, string>()
  private speaking = new Set<string>()
  private targetId: string | null = null
  private joinSeq = 0
  private micBeforeDeaf = true
  private pttHeld = false
  state: VoiceState = { ...INITIAL }
  settings: VoiceSettings = this.load()
  private cbs = new Set<(s: VoiceState) => void>()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKey(e, true))
      window.addEventListener('keyup', (e) => this.onKey(e, false))
    }
  }

  private load(): VoiceSettings {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') } } catch { return { ...DEFAULTS } }
  }
  private saveSettings() { localStorage.setItem(LS, JSON.stringify(this.settings)) }

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
        participants: [{ id: 'u_anya', name: 'Аня', speaking: true, micOn: true }, { id: 'u_me', name: 'Вы', speaking: false, micOn: true }] })
      return
    }

    // screenTrack/screenBy сбрасываем явно: иначе чужая демонстрация из прошлого канала
    // осталась бы висеть (teardownRoom лишь чистит карту треков, но не трогает state)
    this.set({ channelId, channelName, connecting: true, micOn: false, deafened: false, screenOn: false, participants: [], screenTrack: null, screenBy: null })
    try {
      const t = await api.livekitToken(channelId)
      if (this.joinSeq !== seq) return
      const room = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: this.captureOpts() })
      this.room = room
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, p: RemoteParticipant) => this.attach(track, p))
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => this.detach(track))
        .on(RoomEvent.ActiveSpeakersChanged, (sp: Participant[]) => { this.speaking = new Set(sp.map((p) => p.identity)); this.refresh() })
        .on(RoomEvent.ParticipantConnected, () => this.refresh())
        .on(RoomEvent.ParticipantDisconnected, () => this.refresh())
        .on(RoomEvent.LocalTrackPublished, () => this.refresh())
        .on(RoomEvent.Disconnected, () => { if (this.room === room) { this.targetId = null; this.room = null; this.set({ ...INITIAL }) } })
      await room.connect(t.url, t.token)
      if (this.joinSeq !== seq) { room.removeAllListeners(); try { await room.disconnect() } catch { /* */ } return }
      if (this.settings.outputId) await room.switchActiveDevice('audiooutput', this.settings.outputId).catch(() => {})
      const micOn = this.settings.mode === 'voice' // в режиме PTT молчим до нажатия клавиши
      if (micOn) await room.localParticipant.setMicrophoneEnabled(true, this.captureOpts())
      this.set({ connecting: false, micOn })
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
      { id: lp.identity, name: lp.name || 'Вы', speaking: this.speaking.has(lp.identity), micOn: lp.isMicrophoneEnabled },
    ]
    this.room.remoteParticipants.forEach((p: RemoteParticipant) =>
      parts.push({ id: p.identity, name: p.name || p.identity, speaking: this.speaking.has(p.identity), micOn: p.isMicrophoneEnabled }))
    this.set({ participants: parts })
  }

  async toggleMic() {
    const on = !this.state.micOn
    if (!MOCK && this.room) await this.room.localParticipant.setMicrophoneEnabled(on, this.captureOpts()).catch(() => {})
    this.set({ micOn: on })
    this.refresh()
  }
  async toggleDeaf() {
    const d = !this.state.deafened
    this.audioEls.forEach((el) => { el.muted = d })
    let micOn: boolean
    if (d) { this.micBeforeDeaf = this.state.micOn; micOn = false }
    else { micOn = this.micBeforeDeaf }
    if (!MOCK && this.room && micOn !== this.state.micOn) await this.room.localParticipant.setMicrophoneEnabled(micOn, this.captureOpts()).catch(() => {})
    this.set({ deafened: d, micOn })
  }
  async toggleScreen() {
    const on = !this.state.screenOn
    if (MOCK) return this.set({ screenOn: on })
    if (!this.room) return
    try { await this.room.localParticipant.setScreenShareEnabled(on); this.set({ screenOn: on }) } catch { /* отменено */ }
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
    if (this.room && this.state.micOn) { // переопубликовать трек с новыми параметрами
      await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      await this.room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()).catch(() => {})
    }
  }
  async setMode(mode: VoiceMode) {
    this.settings.mode = mode; this.saveSettings()
    if (!this.room) return
    if (mode === 'ptt') { await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); this.set({ micOn: false }) }
    else if (!this.state.deafened) { await this.room.localParticipant.setMicrophoneEnabled(true, this.captureOpts()).catch(() => {}); this.set({ micOn: true }) }
  }
  setPttKey(code: string) { this.settings.pttKey = code; this.saveSettings() }

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
