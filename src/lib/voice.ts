import { Room, RoomEvent, Track, type RemoteTrack, type RemoteParticipant, type Participant } from 'livekit-client'
import { MOCK } from './config'
import { api } from './api'

export interface VoiceParticipant { id: string; name: string; speaking: boolean; micOn: boolean }
export interface VoiceState {
  channelId: string | null
  channelName: string | null
  connecting: boolean
  micOn: boolean
  deafened: boolean
  screenOn: boolean
  participants: VoiceParticipant[]
}

const INITIAL: VoiceState = {
  channelId: null, channelName: null, connecting: false,
  micOn: false, deafened: false, screenOn: false, participants: [],
}

class Voice {
  private room: Room | null = null
  private audioEls = new Map<RemoteTrack, HTMLAudioElement>() // ключ — сам трек (без optional sid)
  private speaking = new Set<string>()
  private targetId: string | null = null // синхронный «куда заходим» — против двойного клика
  private joinSeq = 0
  private micBeforeDeaf = true
  state: VoiceState = { ...INITIAL }
  private cbs = new Set<(s: VoiceState) => void>()

  subscribe(cb: (s: VoiceState) => void): () => void {
    this.cbs.add(cb)
    cb(this.state)
    return () => { this.cbs.delete(cb) }
  }
  private set(p: Partial<VoiceState>) {
    this.state = { ...this.state, ...p }
    this.cbs.forEach((c) => c(this.state))
  }

  async join(channelId: string, channelName: string) {
    if (this.targetId === channelId) return // уже в этом канале или подключаемся к нему
    this.targetId = channelId
    const seq = ++this.joinSeq
    await this.teardownRoom()
    if (this.joinSeq !== seq) return // вытеснены более новым join

    if (MOCK) {
      this.set({ channelId, channelName, connecting: false, micOn: true, deafened: false, screenOn: false,
        participants: [{ id: 'u_anya', name: 'Аня', speaking: true, micOn: true }, { id: 'u_me', name: 'Вы', speaking: false, micOn: true }] })
      return
    }

    this.set({ channelId, channelName, connecting: true, micOn: false, deafened: false, screenOn: false, participants: [] })
    try {
      const t = await api.livekitToken(channelId)
      if (this.joinSeq !== seq) return
      const room = new Room({ adaptiveStream: true, dynacast: true })
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
      await room.localParticipant.setMicrophoneEnabled(true)
      this.set({ connecting: false, micOn: true })
      this.refresh()
    } catch {
      if (this.joinSeq === seq) { this.targetId = null; await this.teardownRoom(); this.set({ ...INITIAL }) }
    }
  }

  private attach(track: RemoteTrack, _participant: RemoteParticipant) {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach() as HTMLAudioElement
      el.muted = this.state.deafened
      el.autoplay = true
      document.body.appendChild(el)
      this.audioEls.set(track, el)
    }
    this.refresh()
  }
  private detach(track: RemoteTrack) {
    track.detach().forEach((el) => el.remove())
    this.audioEls.delete(track)
    this.refresh()
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
    if (!MOCK && this.room) await this.room.localParticipant.setMicrophoneEnabled(on).catch(() => {})
    this.set({ micOn: on })
    this.refresh()
  }

  /** Deafen = заглушить входящие + самозаглушка микрофона (как в Discord), с восстановлением. */
  async toggleDeaf() {
    const d = !this.state.deafened
    this.audioEls.forEach((el) => { el.muted = d })
    let micOn: boolean
    if (d) { this.micBeforeDeaf = this.state.micOn; micOn = false }
    else { micOn = this.micBeforeDeaf }
    if (!MOCK && this.room && micOn !== this.state.micOn) {
      await this.room.localParticipant.setMicrophoneEnabled(micOn).catch(() => {})
    }
    this.set({ deafened: d, micOn })
  }

  async toggleScreen() {
    const on = !this.state.screenOn
    if (MOCK) return this.set({ screenOn: on })
    if (!this.room) return
    try { await this.room.localParticipant.setScreenShareEnabled(on); this.set({ screenOn: on }) } catch { /* отменено пользователем */ }
  }

  async leave() {
    this.targetId = null
    this.joinSeq++ // отменяем любой незавершённый join
    await this.teardownRoom()
    this.set({ ...INITIAL })
  }

  private async teardownRoom() {
    this.audioEls.forEach((el) => el.remove())
    this.audioEls.clear()
    this.speaking.clear()
    const r = this.room
    this.room = null
    if (r) { r.removeAllListeners(); try { await r.disconnect() } catch { /* */ } }
  }
}

export const voice = new Voice()
