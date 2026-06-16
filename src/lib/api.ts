import { MOCK } from './config'
import { http, delay, setTokens } from './http'
import type {
  AuditEntry, Channel, ChannelType, Category, Member, Message, Presence, ReadState, Role, TokenResponse, User, WatchState,
} from './types'
import {
  MOCK_AUDIT, MOCK_CATEGORIES, MOCK_CHANNELS, MOCK_MEMBERS,
  MOCK_MESSAGES, MOCK_READ_STATES, MOCK_USER,
} from '@/mocks/data'

export interface ServerTree { categories: Category[]; channels: Channel[] }
export interface AuthResult { token: TokenResponse; user: User }

// ---- сырые DTO бэка (com.chazhland.messenger.web.dto) ----
interface Page<T> { items: T[]; nextCursor: string | null; hasMore: boolean }
interface UserDto { id: string; username: string; avatarUrl: string | null; status?: string; role?: Role }
interface MemberDto { userId: string; username: string; avatarUrl: string | null; role: Role; status: string; joinedAt: string }
interface ChannelDto { id: string; categoryId: string | null; name: string; type: Channel['type']; topic: string | null; position: number; userLimit: number | null; lastMessageId: string | null }
interface TreeDto { serverId: string; categories: Category[]; channels: ChannelDto[] }
interface AttachmentDto { id: string; url: string; contentType: string; size: number | null; filename: string | null; width: number | null; height: number | null; thumbnailUrl: string | null }
interface ReactionGroupDto { emoji: string; userIds: string[] }
interface MessageDto {
  id: string; channelId: string; authorId: string; content: string | null; replyToId: string | null
  createdAt: string; editedAt: string | null; deleted: boolean
  attachments: AttachmentDto[]; reactions: ReactionGroupDto[]
}
interface AuditDto { id: string; actorId: string; action: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: string }

// ---- кэш для резолва авторов сообщений/аудита ----
let meId = ''
const memberMap = new Map<string, Member>()
const resolveName = (id: string) => memberMap.get(id)?.username ?? id

const MOCK_TOKEN: TokenResponse = { accessToken: 'mock.access', refreshToken: 'mock.refresh', tokenType: 'Bearer', expiresIn: 900 }

function mapMember(d: MemberDto): Member {
  return { userId: d.userId, username: d.username, avatarUrl: d.avatarUrl, role: d.role, status: (d.status as Presence) || 'offline', joinedAt: d.joinedAt }
}
function mapChannel(d: ChannelDto): Channel {
  return { id: d.id, name: d.name, type: d.type, categoryId: d.categoryId, topic: d.topic, position: d.position, userLimit: d.userLimit, lastMessageId: d.lastMessageId }
}
function mapMessage(d: MessageDto, idMap?: Map<string, MessageDto>): Message {
  const author = memberMap.get(d.authorId)
  const reply = d.replyToId && idMap?.get(d.replyToId)
  return {
    id: d.id, channelId: d.channelId, authorId: d.authorId,
    authorName: author?.username ?? d.authorId, authorRole: author?.role,
    content: d.content, deleted: d.deleted, editedAt: d.editedAt, createdAt: d.createdAt, replyToId: d.replyToId,
    replyPreview: reply ? { authorName: resolveName(reply.authorId), content: (reply.content ?? '').slice(0, 60) } : null,
    attachments: (d.attachments ?? []).map((a) => ({ objectKey: a.id, url: a.url, contentType: a.contentType, size: a.size, width: a.width, height: a.height })),
    reactions: (d.reactions ?? []).map((g) => ({ emoji: g.emoji, count: g.userIds.length, mine: g.userIds.includes(meId) })),
  }
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
}
function auditText(d: AuditDto): string {
  const actor = resolveName(d.actorId)
  const tgt = d.targetId ? resolveName(d.targetId) : ''
  switch (d.action) {
    case 'member.kick': return `**${actor}** исключил **${tgt}**`
    case 'member.role-change': return `**${actor}** изменил роль **${tgt}**`
    case 'invite.create': return `**${actor}** создал приглашение`
    case 'invite.revoke': return `**${actor}** отозвал приглашение`
    case 'user.reset-password': return `**${actor}** сбросил пароль **${tgt}**`
    default: return `**${actor}** · ${d.action}`
  }
}

export const api = {
  async login(login: string, password: string): Promise<AuthResult> {
    if (MOCK) { await delay(450); if (!login.trim()) throw new Error('empty'); return { token: MOCK_TOKEN, user: MOCK_USER } }
    const token = await http<TokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) })
    setTokens(token.accessToken, token.refreshToken) // иначе следующий /users/me уйдёт без Authorization → 401
    return { token, user: await this.me(token.accessToken) }
  },

  // Шаг 1 регистрации: код на e-mail (открытая регистрация, без инвайтов)
  async requestEmailCode(email: string): Promise<void> {
    if (MOCK) { await delay(300); return }
    await http('/auth/email-code', { method: 'POST', body: JSON.stringify({ email }) })
  },
  // Шаг 2: e-mail + 6-значный код + ник + пароль
  async register(p: { email: string; code: string; username: string; password: string }): Promise<AuthResult> {
    if (MOCK) { await delay(550); return { token: MOCK_TOKEN, user: { ...MOCK_USER, username: p.username } } }
    const token = await http<TokenResponse>('/auth/register', { method: 'POST', body: JSON.stringify(p) })
    setTokens(token.accessToken, token.refreshToken)
    return { token, user: await this.me() }
  },

  // Сброс пароля по коду на e-mail
  async requestPasswordReset(email: string): Promise<void> {
    if (MOCK) { await delay(300); return }
    await http('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async confirmPasswordReset(p: { email: string; code: string; newPassword: string }): Promise<void> {
    if (MOCK) { await delay(300); return }
    await http('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify(p) })
  },

  async me(_pendingAccess?: string): Promise<User> {
    if (MOCK) { meId = MOCK_USER.id; return MOCK_USER }
    const u = await http<UserDto>('/users/me')
    meId = u.id
    return { id: u.id, username: u.username, avatarUrl: u.avatarUrl }
  },

  async serverTree(): Promise<ServerTree> {
    if (MOCK) { await delay(150); return { categories: MOCK_CATEGORIES, channels: MOCK_CHANNELS } }
    const t = await http<TreeDto>('/server/tree')
    return { categories: t.categories, channels: t.channels.map(mapChannel) }
  },

  async createChannel(p: { name: string; type: ChannelType; categoryId?: string | null; topic?: string | null }): Promise<Channel> {
    if (MOCK) return { id: 'ch_' + crypto.randomUUID().slice(0, 8), name: p.name, type: p.type, categoryId: p.categoryId ?? null, topic: p.topic ?? null, position: 0, lastMessageId: null }
    const dto = await http<ChannelDto>('/channels', { method: 'POST', body: JSON.stringify({ name: p.name, type: p.type, categoryId: p.categoryId ?? null, topic: p.topic ?? null }) })
    return mapChannel(dto)
  },

  async members(): Promise<Member[]> {
    if (MOCK) { await delay(150); MOCK_MEMBERS.forEach((m) => memberMap.set(m.userId, m)); return MOCK_MEMBERS }
    const list = await http<MemberDto[]>('/server/members')
    const mapped = list.map(mapMember)
    memberMap.clear()
    mapped.forEach((m) => memberMap.set(m.userId, m))
    return mapped
  },

  async messages(channelId: string): Promise<Message[]> {
    if (MOCK) { await delay(200); return MOCK_MESSAGES[channelId] ?? [] }
    if (memberMap.size === 0) await this.members()
    const page = await http<Page<MessageDto>>(`/channels/${channelId}/messages?limit=50`)
    const items = [...page.items].reverse() // бэк отдаёт newest-first → разворачиваем в хронологию
    const idMap = new Map(items.map((m) => [m.id, m]))
    return items.map((m) => mapMessage(m, idMap))
  },

  async sendMessage(channelId: string, content: string, replyToId?: string | null): Promise<Message> {
    const clientMessageId = crypto.randomUUID()
    if (MOCK) {
      await delay(120)
      return { id: 'tmp_' + clientMessageId, channelId, authorId: MOCK_USER.id, authorName: MOCK_USER.username, content, attachments: [], reactions: [], replyToId: replyToId ?? null, createdAt: new Date().toISOString(), clientMessageId }
    }
    const dto = await http<MessageDto>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content, clientMessageId, replyToId: replyToId ?? null }) })
    return mapMessage(dto)
  },

  async editMessage(messageId: string, content: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) })
  },
  async deleteMessage(messageId: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}`, { method: 'DELETE' })
  },

  /** маппинг входящего WS-события (raw MessageDto) → UI Message */
  mapIncoming(raw: unknown): Message {
    return mapMessage(raw as MessageDto)
  },

  readStates(): Promise<ReadState[]> {
    if (MOCK) return Promise.resolve(MOCK_READ_STATES)
    return http<ReadState[]>('/read-states')
  },
  ackAll(): Promise<ReadState[]> {
    if (MOCK) return Promise.resolve(MOCK_READ_STATES.map((r) => ({ ...r, mentionCount: 0 })))
    return http<ReadState[]>('/read-states/ack-all', { method: 'POST' })
  },

  async audit(): Promise<AuditEntry[]> {
    if (MOCK) { await delay(150); return MOCK_AUDIT }
    const list = await http<AuditDto[]>('/admin/audit')
    if (memberMap.size === 0) await this.members()
    return list.map((d) => ({
      id: d.id, action: d.action, actorName: resolveName(d.actorId), text: auditText(d),
      meta: `${d.action}${d.targetType ? ' · ' + d.targetType : ''}${d.targetId ? ':' + d.targetId : ''}`,
      createdAt: fmtDateTime(d.createdAt),
    }))
  },

  // ---- actions ----
  async addReaction(messageId: string, emoji: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) })
  },
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' })
  },
  async markRead(channelId: string, lastReadMessageId: string): Promise<void> {
    if (MOCK) return
    await http(`/channels/${channelId}/read-state`, { method: 'PUT', body: JSON.stringify({ lastReadMessageId }) })
  },
  async kick(userId: string): Promise<void> {
    if (MOCK) return
    await http(`/members/${userId}`, { method: 'DELETE' })
  },
  async changeRole(userId: string, role: Role): Promise<void> {
    if (MOCK) return
    await http(`/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) })
  },

  // ---- voice (LiveKit) ----
  async livekitToken(channelId: string): Promise<{ token: string; url: string; room: string }> {
    if (MOCK) return { token: '', url: '', room: channelId }
    return http(`/livekit/token`, { method: 'POST', body: JSON.stringify({ channelId }) })
  },

  // ---- watch-party ----
  async watchState(channelId: string): Promise<WatchState | null> {
    if (MOCK) return null
    const s = await http<WatchState | undefined>(`/channels/${channelId}/watch`).catch(() => null)
    return s ?? null // 204 (нет источника) → null
  },
  async setWatchSource(channelId: string, url: string): Promise<WatchState> {
    if (MOCK) return { url, paused: true, positionSeconds: 0, updatedAt: Date.now(), hostId: '', lastActionBy: '' }
    return http(`/channels/${channelId}/watch/source`, { method: 'POST', body: JSON.stringify({ url }) })
  },
  async stopWatch(channelId: string): Promise<void> {
    if (MOCK) return
    await http(`/channels/${channelId}/watch`, { method: 'DELETE' })
  },
}
