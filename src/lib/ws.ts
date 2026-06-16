import { Client, type IMessage } from '@stomp/stompjs'
import { MOCK, WS_URL } from './config'

export interface WsEvent { type: string; channelId?: string; message?: unknown; userId?: string }

// STOMP-over-WebSocket клиент. В mock-режиме — no-op (приложение работает без бэка).
class Ws {
  private client: Client | null = null
  private subs = new Map<string, () => void>()

  connect(token: string) {
    if (MOCK) return
    this.disconnect()
    this.client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })
    this.client.activate()
  }

  /** Подписка на /topic/channel.{id}. Возвращает функцию отписки. */
  onChannel(channelId: string, cb: (e: WsEvent) => void): () => void {
    if (MOCK || !this.client) return () => {}
    const dest = `/topic/channel.${channelId}`
    const sub = this.client.subscribe(dest, (m: IMessage) => {
      try { cb(JSON.parse(m.body) as WsEvent) } catch { /* ignore */ }
    })
    const off = () => sub.unsubscribe()
    this.subs.set(dest, off)
    return off
  }

  typing(channelId: string) {
    if (MOCK || !this.client?.connected) return
    this.client.publish({ destination: `/app/channel.${channelId}.typing`, body: '{}' })
  }

  disconnect() {
    this.subs.forEach((off) => off())
    this.subs.clear()
    this.client?.deactivate()
    this.client = null
  }
}

export const ws = new Ws()
