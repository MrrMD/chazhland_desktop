import { MOCK } from './config'
import { http, delay } from './http'
import type {
  AuditEntry, Channel, Category, Invite, Member, Message, ReadState, TokenResponse, User,
} from './types'
import {
  MOCK_AUDIT, MOCK_CATEGORIES, MOCK_CHANNELS, MOCK_INVITES, MOCK_MEMBERS,
  MOCK_MESSAGES, MOCK_READ_STATES, MOCK_USER,
} from '@/mocks/data'

export interface ServerTree {
  categories: Category[]
  channels: Channel[]
}
export interface AuthResult {
  token: TokenResponse
  user: User
}

const MOCK_TOKEN: TokenResponse = {
  accessToken: 'mock.access', refreshToken: 'mock.refresh', tokenType: 'Bearer', expiresIn: 900,
}

export const api = {
  // ---- auth (POST /auth/login, /auth/register) ----
  async login(login: string, _password: string): Promise<AuthResult> {
    if (MOCK) {
      await delay(450)
      if (!login.trim()) throw new Error('empty')
      return { token: MOCK_TOKEN, user: MOCK_USER }
    }
    const token = await http<TokenResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ login, password: _password }),
    })
    return { token, user: await this.me() }
  },

  async register(p: { inviteCode: string; username: string; email: string; password: string }): Promise<AuthResult> {
    if (MOCK) {
      await delay(550)
      return { token: MOCK_TOKEN, user: { ...MOCK_USER, username: p.username } }
    }
    const token = await http<TokenResponse>('/auth/register', { method: 'POST', body: JSON.stringify(p) })
    return { token, user: await this.me() }
  },

  me(): Promise<User> {
    if (MOCK) return Promise.resolve(MOCK_USER)
    return http<User>('/users/me')
  },

  // ---- server structure (GET /server/tree) ----
  async serverTree(): Promise<ServerTree> {
    if (MOCK) {
      await delay(150)
      return { categories: MOCK_CATEGORIES, channels: MOCK_CHANNELS }
    }
    return http<ServerTree>('/server/tree')
  },

  // ---- messages (GET/POST /channels/{id}/messages) ----
  async messages(channelId: string): Promise<Message[]> {
    if (MOCK) {
      await delay(200)
      return MOCK_MESSAGES[channelId] ?? []
    }
    return http<Message[]>(`/channels/${channelId}/messages`)
  },

  async sendMessage(channelId: string, content: string): Promise<Message> {
    const clientMessageId = crypto.randomUUID()
    if (MOCK) {
      await delay(120)
      return {
        id: 'tmp_' + clientMessageId, channelId, authorId: MOCK_USER.id, authorName: MOCK_USER.username,
        content, attachments: [], reactions: [], createdAt: new Date().toISOString(), clientMessageId,
      }
    }
    return http<Message>(`/channels/${channelId}/messages`, {
      method: 'POST', body: JSON.stringify({ content, clientMessageId }),
    })
  },

  // ---- members / read-state / admin ----
  members(): Promise<Member[]> {
    if (MOCK) return delay(150).then(() => MOCK_MEMBERS)
    return http<Member[]>('/server/members')
  },
  readStates(): Promise<ReadState[]> {
    if (MOCK) return Promise.resolve(MOCK_READ_STATES)
    return http<ReadState[]>('/read-states')
  },
  ackAll(): Promise<ReadState[]> {
    if (MOCK) return Promise.resolve(MOCK_READ_STATES.map((r) => ({ ...r, mentionCount: 0 })))
    return http<ReadState[]>('/read-states/ack-all', { method: 'POST' })
  },
  invites(): Promise<Invite[]> {
    if (MOCK) return delay(150).then(() => MOCK_INVITES)
    return http<Invite[]>('/invites')
  },
  audit(): Promise<AuditEntry[]> {
    if (MOCK) return delay(150).then(() => MOCK_AUDIT)
    // боевой ответ маппится в AuditEntry на месте; здесь — упрощённо
    return http<AuditEntry[]>('/admin/audit')
  },
}
