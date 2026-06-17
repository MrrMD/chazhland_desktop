import { MOCK } from './config'
import { ws } from './ws'
import { api } from './api'
import type { Presence } from './types'

interface PEvent { type: string; userId: string; status?: string; channelId?: string; inVoice?: boolean }

// Живые онлайн-статусы участников: снапшот при старте (GET /presence) + дельты по /topic/presence,
// и собственный heartbeat (/app/presence.heartbeat) каждые ~20с. Отсутствие в карте = offline.
class PresenceStore {
  private statuses = new Map<string, Presence>()
  private voiceByChannel = new Map<string, Set<string>>() // channelId -> userId[] из VOICE_UPDATE/снапшота
  private offEvents: (() => void) | null = null
  private offStatus: (() => void) | null = null
  private timer: number | null = null
  private started = false
  private loadingSnap = false
  private pending: PEvent[] = [] // дельты, пришедшие во время запроса снапшота
  myStatus: Presence = 'online'
  private cbs = new Set<() => void>()

  subscribe(cb: () => void): () => void { this.cbs.add(cb); return () => { this.cbs.delete(cb) } }
  private emit() { this.cbs.forEach((c) => c()) }
  statusOf(userId: string): Presence { return this.statuses.get(userId) ?? 'offline' }
  /** Кто сейчас в голосовом канале (по данным бэка из LiveKit-вебхуков — видно ещё до входа). */
  voiceMembers(channelId: string): string[] { return [...(this.voiceByChannel.get(channelId) ?? [])] }

  // Применяет дельту присутствия к переданным картам (общий код для live-обработчика и
  // переигровки pending поверх снапшота).
  private applyEvent(e: PEvent, statuses: Map<string, Presence>, voice: Map<string, Set<string>>) {
    if (!e.userId) return
    if (e.type === 'VOICE_UPDATE' && e.channelId) {
      if (e.inVoice) {
        voice.forEach((set) => set.delete(e.userId!)) // в одном голосовом за раз — чистим из прочих
        let set = voice.get(e.channelId); if (!set) { set = new Set(); voice.set(e.channelId, set) }
        set.add(e.userId)
      } else {
        voice.get(e.channelId)?.delete(e.userId)
      }
    } else if (e.type === 'PRESENCE_UPDATE') {
      const s = (e.status as Presence) || 'offline'
      if (s === 'offline') statuses.delete(e.userId); else statuses.set(e.userId, s)
    }
  }

  // снапшот онлайна (GET /presence); вызываем при старте И на каждом WS-коннекте —
  // на старте чужие connect-heartbeat'ы могли ещё не попасть в Redis, поэтому одного раза мало
  private async loadSnapshot() {
    this.loadingSnap = true
    this.pending = []
    try {
      const snap = await api.presenceSnapshot()
      const next = new Map<string, Presence>()
      snap.online.forEach((u) => next.set(u.userId, (u.status as Presence) || 'online'))
      const nextVoice = new Map<string, Set<string>>()
      for (const [cid, ids] of Object.entries(snap.voice || {})) nextVoice.set(cid, new Set(ids))
      // дельты, прилетевшие во время запроса, новее снапшота — накатываем поверх (иначе clear их терял)
      for (const e of this.pending) this.applyEvent(e, next, nextVoice)
      this.statuses = next
      this.voiceByChannel = nextVoice
      this.emit()
    } catch { /* снапшот не критичен — догоним по дельтам */ }
    finally { this.loadingSnap = false; this.pending = [] }
  }

  async start() {
    if (MOCK || this.started) return
    this.started = true

    this.offEvents = ws.onPresence((e: PEvent) => {
      if (!e.userId) return
      if (this.loadingSnap) this.pending.push(e) // переиграем после применения снапшота
      this.applyEvent(e, this.statuses, this.voiceByChannel)
      this.emit()
    })
    // при появлении соединения (и на каждом реконнекте): свой heartbeat сразу + свежий снапшот,
    // чтобы онлайн появлялся мгновенно, а не через ~20с по таймеру/дельтам
    this.offStatus = ws.onStatus((st) => { if (st === 'online') { ws.heartbeat(this.myStatus); this.loadSnapshot() } })
    this.timer = window.setInterval(() => ws.heartbeat(this.myStatus), 20000)
  }

  setStatus(s: Presence) { this.myStatus = s; ws.heartbeat(s) }

  stop() {
    this.offEvents?.(); this.offEvents = null
    this.offStatus?.(); this.offStatus = null
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.statuses.clear()
    this.voiceByChannel.clear()
    this.started = false
    this.emit()
  }
}

export const presence = new PresenceStore()
