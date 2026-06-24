import { MOCK } from './config'
import { http, delay, setTokens } from './http'
import type {
  AttachmentInput, AuditEntry, Channel, ChannelOverwrite, ChannelType, Category, Dm, Member, Message, NotificationLevel, OverwriteTarget, Permission, Presence, ReadState, Role, ServerRole, TokenResponse, User, WatchState, WatchSourceRequest, WatchSearchResult,
} from './types'
import {
  MOCK_AUDIT, MOCK_CATEGORIES, MOCK_CHANNELS, MOCK_MEMBERS,
  MOCK_MESSAGES, MOCK_READ_STATES, MOCK_USER,
} from '@/mocks/data'

export interface ServerTree { categories: Category[]; channels: Channel[] }
export interface AuthResult { token: TokenResponse; user: User }
export interface SoundClip { id: string; name: string; url: string } // звук саундпада (бэк: SoundboardResponse)

// ---- сырые DTO бэка (com.chazhland.messenger.web.dto) ----
interface Page<T> { items: T[]; nextCursor: string | null; hasMore: boolean }
interface UserDto { id: string; username: string; avatarUrl: string | null; status?: string; statusMessage?: string | null; role?: Role }
interface MemberDto { userId: string; username: string; avatarUrl: string | null; role: Role; status: string; joinedAt: string; soundboardDisabled?: boolean; roleIds?: string[]; statusMessage?: string | null }
interface ChannelDto { id: string; categoryId: string | null; name: string; type: Channel['type']; topic: string | null; position: number; userLimit: number | null; slowModeSeconds: number; lastMessageId: string | null }
interface TreeDto { serverId: string; categories: Category[]; channels: ChannelDto[] }
interface AttachmentDto { id: string; url: string; contentType: string; size: number | null; filename: string | null; width: number | null; height: number | null; thumbnailUrl: string | null }
interface ReactionGroupDto { emoji: string; userIds: string[] }
interface MessageDto {
  id: string; channelId: string; authorId: string; content: string | null; replyToId: string | null
  createdAt: string; editedAt: string | null; deleted: boolean; pinnedAt: string | null
  attachments: AttachmentDto[]; reactions: ReactionGroupDto[]
}
interface AuditDto { id: string; actorId: string; action: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: string }
interface DmDto { channelId: string; otherUserId: string; otherUsername: string; otherAvatarUrl: string | null; lastMessageId: string | null }

// ---- кэш для резолва авторов сообщений/аудита ----
let meId = ''
const memberMap = new Map<string, Member>()
const resolveName = (id: string) => memberMap.get(id)?.username ?? id

const MOCK_TOKEN: TokenResponse = { accessToken: 'mock.access', refreshToken: 'mock.refresh', tokenType: 'Bearer', expiresIn: 900 }

function mapMember(d: MemberDto): Member {
  return { userId: d.userId, username: d.username, avatarUrl: d.avatarUrl, role: d.role, status: (d.status as Presence) || 'offline', joinedAt: d.joinedAt, soundboardDisabled: d.soundboardDisabled ?? false, roleIds: d.roleIds ?? [], statusMessage: d.statusMessage ?? null }
}
function mapChannel(d: ChannelDto): Channel {
  return { id: d.id, name: d.name, type: d.type, categoryId: d.categoryId, topic: d.topic, position: d.position, userLimit: d.userLimit, slowModeSeconds: d.slowModeSeconds ?? 0, lastMessageId: d.lastMessageId }
}
function mapMessage(d: MessageDto, idMap?: Map<string, MessageDto>): Message {
  const author = memberMap.get(d.authorId)
  const reply = d.replyToId && idMap?.get(d.replyToId)
  return {
    id: d.id, channelId: d.channelId, authorId: d.authorId,
    authorName: author?.username ?? d.authorId, authorAvatarUrl: author?.avatarUrl ?? null, authorRole: author?.role,
    content: d.content, deleted: d.deleted, editedAt: d.editedAt, pinnedAt: d.pinnedAt, createdAt: d.createdAt, replyToId: d.replyToId,
    replyPreview: reply ? { authorName: resolveName(reply.authorId), content: (reply.content ?? '').slice(0, 60) } : null,
    attachments: (d.attachments ?? []).map((a) => ({ objectKey: a.id, url: a.url, contentType: a.contentType, filename: a.filename, size: a.size, width: a.width, height: a.height })),
    reactions: (d.reactions ?? []).map((g) => ({ emoji: g.emoji, count: g.userIds.length, mine: g.userIds.includes(meId) })),
  }
}

// размеры картинки (подсказка вёрстке) — читаем до загрузки
function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
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
    return { id: u.id, username: u.username, avatarUrl: u.avatarUrl, statusMessage: u.statusMessage ?? null }
  },

  // ---- профиль / настройки аккаунта ----
  async updateProfile(p: { username?: string; statusMessage?: string }): Promise<User> {
    if (MOCK) { await delay(250); return { ...MOCK_USER, ...p } }
    const u = await http<UserDto>('/users/me', { method: 'PATCH', body: JSON.stringify(p) })
    return { id: u.id, username: u.username, avatarUrl: u.avatarUrl, statusMessage: u.statusMessage ?? null }
  },
  async setAvatar(objectKey: string): Promise<User> {
    if (MOCK) { await delay(250); return MOCK_USER }
    const u = await http<UserDto>('/users/me/avatar', { method: 'PUT', body: JSON.stringify({ objectKey }) })
    return { id: u.id, username: u.username, avatarUrl: u.avatarUrl, statusMessage: u.statusMessage ?? null }
  },
  async changePassword(p: { currentPassword: string; newPassword: string }): Promise<void> {
    if (MOCK) { await delay(300); return }
    await http('/users/me/password', { method: 'PUT', body: JSON.stringify(p) })
  },
  async logoutAll(): Promise<void> {
    if (MOCK) return
    await http('/users/me/logout-all', { method: 'POST' })
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
  // PATCH /channels/{id}. ВАЖНО: categoryId=null на бэке = «без категории», поэтому всегда шлём текущий,
  // чтобы правка имени/темы не выкинула канал из его категории.
  async updateChannel(id: string, p: { name: string; categoryId?: string | null; topic?: string | null; userLimit?: number | null; slowModeSeconds?: number | null }): Promise<Channel> {
    if (MOCK) { const cur = MOCK_CHANNELS.find((c) => c.id === id); return { ...(cur as Channel), name: p.name, categoryId: p.categoryId ?? null, topic: p.topic ?? null, userLimit: p.userLimit ?? null, slowModeSeconds: p.slowModeSeconds ?? 0 } }
    const dto = await http<ChannelDto>(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(p) })
    return mapChannel(dto)
  },
  async deleteChannel(id: string): Promise<void> {
    if (MOCK) return
    await http(`/channels/${id}`, { method: 'DELETE' })
  },
  // ---- уведомления по каналам (персональные, синкаются между устройствами) ----
  async notificationSettings(): Promise<{ channelId: string; level: NotificationLevel }[]> {
    if (MOCK) return []
    return http<{ channelId: string; level: NotificationLevel }[]>('/notification-settings')
  },
  async setChannelNotification(channelId: string, level: NotificationLevel): Promise<void> {
    if (MOCK) return
    await http(`/channels/${channelId}/notification-setting`, { method: 'PUT', body: JSON.stringify({ level }) })
  },

  // ---- личные сообщения (DM = скрытый канал type=DM) ----
  async openDm(userId: string): Promise<Dm> {
    if (MOCK) { await delay(150); return { id: 'dm_' + userId, name: memberMap.get(userId)?.username ?? 'Личные', avatarUrl: memberMap.get(userId)?.avatarUrl ?? null, otherUserId: userId } }
    const d = await http<DmDto>(`/dm/${userId}`, { method: 'POST' })
    return { id: d.channelId, name: d.otherUsername, avatarUrl: d.otherAvatarUrl, otherUserId: d.otherUserId }
  },
  async listDms(): Promise<Dm[]> {
    if (MOCK) return []
    const list = await http<DmDto[]>('/dm')
    return list.map((d) => ({ id: d.channelId, name: d.otherUsername, avatarUrl: d.otherAvatarUrl, otherUserId: d.otherUserId }))
  },

  async members(): Promise<Member[]> {
    if (MOCK) { await delay(150); MOCK_MEMBERS.forEach((m) => memberMap.set(m.userId, m)); return MOCK_MEMBERS }
    const list = await http<MemberDto[]>('/server/members')
    const mapped = list.map(mapMember)
    memberMap.clear()
    mapped.forEach((m) => memberMap.set(m.userId, m))
    return mapped
  },

  // ---- саундпад (общий, серверный): загрузил один — слышат все ----
  async listSoundboard(): Promise<SoundClip[]> {
    if (MOCK) return []
    return http<SoundClip[]>('/soundboard')
  },
  async createSoundboard(name: string, objectKey: string): Promise<SoundClip> {
    if (MOCK) return { id: 'sb_' + crypto.randomUUID().slice(0, 8), name, url: '' }
    return http<SoundClip>('/soundboard', { method: 'POST', body: JSON.stringify({ name, objectKey }) })
  },
  async deleteSoundboard(id: string): Promise<void> {
    if (MOCK) return
    await http(`/soundboard/${id}`, { method: 'DELETE' })
  },
  // включить/выключить саундпад участнику (admin/owner; даже на админов)
  async setMemberSoundboard(userId: string, disabled: boolean): Promise<void> {
    if (MOCK) return
    await http(`/members/${userId}/soundboard`, { method: 'PUT', body: JSON.stringify({ disabled }) })
  },

  // ---- кастомные роли ----
  async roles(): Promise<ServerRole[]> {
    if (MOCK) return []
    return http<ServerRole[]>('/roles')
  },
  async createRole(p: { name: string; color?: string | null; permissions: Permission[] }): Promise<ServerRole> {
    if (MOCK) return { id: 'r_' + crypto.randomUUID().slice(0, 8), name: p.name, color: p.color ?? null, position: 1, permissions: p.permissions, isDefault: false }
    return http<ServerRole>('/roles', { method: 'POST', body: JSON.stringify(p) })
  },
  async updateRole(id: string, p: { name: string; color?: string | null; permissions: Permission[] }): Promise<ServerRole> {
    if (MOCK) return { id, name: p.name, color: p.color ?? null, position: 1, permissions: p.permissions, isDefault: false }
    return http<ServerRole>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(p) })
  },
  async deleteRole(id: string): Promise<void> {
    if (MOCK) return
    await http(`/roles/${id}`, { method: 'DELETE' })
  },
  async assignRole(roleId: string, userId: string): Promise<void> {
    if (MOCK) return
    await http(`/roles/${roleId}/members/${userId}`, { method: 'PUT' })
  },
  async unassignRole(roleId: string, userId: string): Promise<void> {
    if (MOCK) return
    await http(`/roles/${roleId}/members/${userId}`, { method: 'DELETE' })
  },

  // ---- доступ к каналам (перекрытия прав ролей/участников) ----
  async channelPermissions(channelId: string): Promise<ChannelOverwrite[]> {
    if (MOCK) return []
    return http<ChannelOverwrite[]>(`/channels/${channelId}/permissions`)
  },
  async setChannelPermission(channelId: string, p: { targetType: OverwriteTarget; targetId: string; allow: Permission[]; deny: Permission[] }): Promise<ChannelOverwrite> {
    if (MOCK) return { id: 'ow_' + crypto.randomUUID().slice(0, 8), ...p }
    return http<ChannelOverwrite>(`/channels/${channelId}/permissions`, { method: 'PUT', body: JSON.stringify(p) })
  },
  async clearChannelPermission(channelId: string, targetType: OverwriteTarget, targetId: string): Promise<void> {
    if (MOCK) return
    await http(`/channels/${channelId}/permissions/${targetType}/${targetId}`, { method: 'DELETE' })
  },

  async presenceSnapshot(): Promise<{ online: { userId: string; status: string }[]; voice: Record<string, string[]> }> {
    if (MOCK) return { online: [], voice: {} }
    return http('/presence')
  },

  async messages(channelId: string): Promise<Message[]> {
    if (MOCK) { await delay(200); return MOCK_MESSAGES[channelId] ?? [] }
    if (memberMap.size === 0) await this.members()
    const page = await http<Page<MessageDto>>(`/channels/${channelId}/messages?limit=50`)
    const items = [...page.items].reverse() // бэк отдаёт newest-first → разворачиваем в хронологию
    const idMap = new Map(items.map((m) => [m.id, m]))
    return items.map((m) => mapMessage(m, idMap))
  },

  // подгрузка более старых сообщений (курсор before = id самого старого загруженного)
  async olderMessages(channelId: string, beforeId: string): Promise<Message[]> {
    if (MOCK) { await delay(200); return [] }
    if (memberMap.size === 0) await this.members()
    const page = await http<Page<MessageDto>>(`/channels/${channelId}/messages?before=${encodeURIComponent(beforeId)}&limit=50`)
    const items = [...page.items].reverse() // newest-first → хронология
    const idMap = new Map(items.map((m) => [m.id, m]))
    return items.map((m) => mapMessage(m, idMap))
  },

  // окно сообщений вокруг цели (для перехода из поиска/пинов): before(старее) + after(новее).
  // Оба курсора ИСКЛЮЧАЮТ саму цель — её вставляем из готового результата поиска. ULID-id монотонны
  // (лексикографически = хронологически).
  async contextMessages(channelId: string, target: Message): Promise<{ messages: Message[]; hasOlder: boolean }> {
    if (MOCK) return { messages: [target], hasOlder: false }
    if (memberMap.size === 0) await this.members()
    const [olderPage, newerPage] = await Promise.all([
      http<Page<MessageDto>>(`/channels/${channelId}/messages?before=${encodeURIComponent(target.id)}&limit=25`),
      http<Page<MessageDto>>(`/channels/${channelId}/messages?after=${encodeURIComponent(target.id)}&limit=25`),
    ])
    // Не полагаемся на порядок, в котором бэк отдаёт before/after: оставляем строго старее/новее цели,
    // отбрасываем дубли (пересечение страниц) и пересортировываем по id — одной сортировки достаточно
    // для верной хронологии, какой бы порядок ни вернул бэк.
    const older = olderPage.items.filter((m) => m.id < target.id)
    const newer = newerPage.items.filter((m) => m.id > target.id)
    const idMap = new Map([...older, ...newer].map((m) => [m.id, m]))
    const seen = new Set<string>([target.id])
    const windowed: Message[] = [target]
    for (const dto of [...older, ...newer]) {
      if (seen.has(dto.id)) continue
      seen.add(dto.id)
      windowed.push(mapMessage(dto, idMap))
    }
    windowed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    // достроить превью ответов на сообщения внутри окна, включая саму цель (её нет в DTO-idMap)
    const byId = new Map(windowed.map((m) => [m.id, m]))
    const messages = windowed.map((m) => {
      if (!m.replyToId || m.replyPreview) return m
      const p = byId.get(m.replyToId)
      return p ? { ...m, replyPreview: { authorName: p.authorName, content: (p.content ?? '').slice(0, 60) } } : m
    })
    return { messages, hasOlder: olderPage.hasMore }
  },

  async sendMessage(channelId: string, content: string, replyToId?: string | null, attachments?: AttachmentInput[]): Promise<Message> {
    const clientMessageId = crypto.randomUUID()
    const atts = attachments?.length ? attachments : undefined
    if (MOCK) {
      await delay(120)
      return { id: 'tmp_' + clientMessageId, channelId, authorId: MOCK_USER.id, authorName: MOCK_USER.username, content,
        attachments: (atts ?? []).map((a) => ({ objectKey: a.objectKey, url: '', contentType: 'image/*', filename: a.filename, width: a.width, height: a.height })),
        reactions: [], replyToId: replyToId ?? null, createdAt: new Date().toISOString(), clientMessageId }
    }
    const dto = await http<MessageDto>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content, clientMessageId, replyToId: replyToId ?? null, ...(atts ? { attachments: atts } : {}) }) })
    return mapMessage(dto)
  },

  // presign + прямой PUT в MinIO; возвращает ссылку для отправки сообщения
  async presign(filename: string, contentType: string, size: number): Promise<{ uploadUrl: string; objectKey: string }> {
    return http('/attachments/presign', { method: 'POST', body: JSON.stringify({ filename, contentType, size }) })
  },
  async uploadFile(file: File): Promise<AttachmentInput> {
    let width: number | undefined, height: number | undefined
    if (file.type.startsWith('image/')) {
      try { const d = await imageSize(file); width = d.w; height = d.h } catch { /* не картинка/битый файл — без размеров */ }
    }
    if (MOCK) { await delay(400); return { objectKey: 'mock/' + file.name, filename: file.name, width, height } }
    const ct = file.type || 'application/octet-stream'
    const { uploadUrl, objectKey } = await this.presign(file.name, ct, file.size)
    const put = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': ct } }) // прямой аплоад, без api-обёртки
    if (!put.ok) throw new Error(`upload ${put.status}`)
    return { objectKey, filename: file.name, width, height }
  },

  async editMessage(messageId: string, content: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) })
  },

  // поиск по тексту в канале
  async searchMessages(channelId: string, q: string): Promise<Message[]> {
    if (MOCK) { await delay(150); const s = q.toLowerCase(); return (MOCK_MESSAGES[channelId] ?? []).filter((m) => (m.content ?? '').toLowerCase().includes(s)) }
    if (memberMap.size === 0) await this.members()
    const page = await http<Page<MessageDto>>(`/channels/${channelId}/messages/search?q=${encodeURIComponent(q)}&limit=30`)
    return page.items.map((m) => mapMessage(m))
  },
  // закреплённые сообщения канала
  async pins(channelId: string): Promise<Message[]> {
    if (MOCK) return []
    if (memberMap.size === 0) await this.members()
    const list = await http<MessageDto[]>(`/channels/${channelId}/pins`)
    return list.map((m) => mapMessage(m))
  },
  async pin(messageId: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}/pin`, { method: 'PUT' })
  },
  async unpin(messageId: string): Promise<void> {
    if (MOCK) return
    await http(`/messages/${messageId}/pin`, { method: 'DELETE' })
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
    // бэк отдаёт конверт курсорной пагинации Page<T>{items,nextCursor,hasMore}, а не плоский массив
    const page = await http<Page<AuditDto>>('/admin/audit')
    if (memberMap.size === 0) await this.members()
    return page.items.map((d) => ({
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
  // админ сбрасывает пароль участнику → бэк возвращает одноразовый временный пароль (показать один раз)
  async resetMemberPassword(userId: string): Promise<string> {
    if (MOCK) return 'Tmp-' + userId.slice(0, 4) + '-9F3kQ'
    const r = await http<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: 'POST' })
    return r.temporaryPassword
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
  async setWatchSource(channelId: string, req: WatchSourceRequest): Promise<WatchState> {
    const kind = req.kind ?? 'DIRECT'
    if (MOCK) return { url: req.url ?? null, paused: true, positionSeconds: 0, updatedAt: Date.now(), hostId: '', lastActionBy: '', source: { kind, url: req.url ?? null, infoHash: req.infoHash ?? null } }
    return http(`/channels/${channelId}/watch/source`, { method: 'POST', body: JSON.stringify(req) })
  },
  // поиск торрентов по названию (Prowlarr на бэке); 503 — поиск не настроен/недоступен, 400 — q < 2 символов
  async searchWatch(channelId: string, q: string): Promise<WatchSearchResult[]> {
    if (MOCK) { await delay(400); return [] }
    return http(`/channels/${channelId}/watch/search?q=${encodeURIComponent(q)}`)
  },
  async stopWatch(channelId: string): Promise<void> {
    if (MOCK) return
    await http(`/channels/${channelId}/watch`, { method: 'DELETE' })
  },
}
