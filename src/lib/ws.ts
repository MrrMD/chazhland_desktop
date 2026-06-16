import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { MOCK, WS_URL } from './config'

export interface WsEvent { type: string; channelId?: string; message?: unknown; userId?: string }
export type WsStatus = 'online' | 'connecting'

interface Spec { channelId: string; cb: (e: WsEvent) => void; sub: StompSubscription | null }

// STOMP-over-WebSocket клиент. В mock-режиме — no-op, статус всегда online (баннер скрыт).
class Ws {
  private client: Client | null = null
  private specs = new Set<Spec>() // логические подписки компонентов — переживают реконнект
  private status: WsStatus = 'online'
  private statusCbs = new Set<(s: WsStatus) => void>()

  getStatus() { return this.status }
  onStatus(cb: (s: WsStatus) => void): () => void {
    this.statusCbs.add(cb)
    cb(this.status)
    return () => { this.statusCbs.delete(cb) }
  }
  private setStatus(s: WsStatus) {
    if (s === this.status) return
    this.status = s
    this.statusCbs.forEach((c) => c(s))
  }

  /** (Пере)подключение с актуальным токеном. Подписки переустанавливаются в onConnect. */
  connect(token: string) {
    if (MOCK) { this.setStatus('online'); return }
    this.teardownClient()
    this.setStatus('connecting')
    this.client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.setStatus('online')
        this.specs.forEach((s) => this.subscribeSpec(s)) // переподписка после (ре)коннекта
      },
      onWebSocketClose: () => this.setStatus('connecting'),
      onStompError: () => this.setStatus('connecting'),
    })
    this.client.activate()
  }

  private subscribeSpec(s: Spec) {
    if (!this.client?.connected) return
    s.sub = this.client.subscribe(`/topic/channel.${s.channelId}`, (m: IMessage) => {
      try { s.cb(JSON.parse(m.body) as WsEvent) } catch { /* ignore */ }
    })
  }

  /** Подписка на /topic/channel.{id}. Возвращает функцию отписки. */
  onChannel(channelId: string, cb: (e: WsEvent) => void): () => void {
    if (MOCK) return () => {}
    const s: Spec = { channelId, cb, sub: null }
    this.specs.add(s)
    this.subscribeSpec(s)
    return () => { s.sub?.unsubscribe(); this.specs.delete(s) }
  }

  typing(channelId: string) {
    if (MOCK || !this.client?.connected) return
    this.client.publish({ destination: `/app/channel.${channelId}.typing`, body: '{}' })
  }

  /** Сброс соединения с сохранением логических подписок (для реконнекта/смены токена). */
  private teardownClient() {
    this.specs.forEach((s) => { s.sub = null })
    this.client?.deactivate()
    this.client = null
  }

  /** Полный сброс (logout). */
  disconnect() {
    this.specs.clear()
    this.client?.deactivate()
    this.client = null
  }
}

export const ws = new Ws()
