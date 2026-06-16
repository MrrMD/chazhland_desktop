import { MOCK } from './config'
import { ws } from './ws'
import { api } from './api'
import type { Presence } from './types'

interface PEvent { type: string; userId: string; status?: string; channelId?: string; inVoice?: boolean }

// Живые онлайн-статусы участников: снапшот при старте (GET /presence) + дельты по /topic/presence,
// и собственный heartbeat (/app/presence.heartbeat) каждые ~20с. Отсутствие в карте = offline.
class PresenceStore {
  private statuses = new Map<string, Presence>()
  private offEvents: (() => void) | null = null
  private offStatus: (() => void) | null = null
  private timer: number | null = null
  private started = false
  myStatus: Presence = 'online'
  private cbs = new Set<() => void>()

  subscribe(cb: () => void): () => void { this.cbs.add(cb); return () => { this.cbs.delete(cb) } }
  private emit() { this.cbs.forEach((c) => c()) }
  statusOf(userId: string): Presence { return this.statuses.get(userId) ?? 'offline' }

  async start() {
    if (MOCK || this.started) return
    this.started = true
    try {
      const snap = await api.presenceSnapshot()
      this.statuses.clear()
      snap.online.forEach((u) => this.statuses.set(u.userId, (u.status as Presence) || 'online'))
      this.emit()
    } catch { /* снапшот не критичен — догоним по дельтам */ }

    this.offEvents = ws.onPresence((e: PEvent) => {
      if (e.type !== 'PRESENCE_UPDATE' || !e.userId) return
      const s = (e.status as Presence) || 'offline'
      if (s === 'offline') this.statuses.delete(e.userId)
      else this.statuses.set(e.userId, s)
      this.emit()
    })
    // шлём свой статус сразу при появлении соединения (и на каждом реконнекте)
    this.offStatus = ws.onStatus((st) => { if (st === 'online') ws.heartbeat(this.myStatus) })
    this.timer = window.setInterval(() => ws.heartbeat(this.myStatus), 20000)
  }

  setStatus(s: Presence) { this.myStatus = s; ws.heartbeat(s) }

  stop() {
    this.offEvents?.(); this.offEvents = null
    this.offStatus?.(); this.offStatus = null
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.statuses.clear()
    this.started = false
    this.emit()
  }
}

export const presence = new PresenceStore()
