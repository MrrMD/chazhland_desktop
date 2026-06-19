// DTO по контракту бэка com.chazhland.messenger (см. docs/DESIGN_BRIEF.md).
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type Presence = 'online' | 'idle' | 'dnd' | 'offline'
export type ChannelType = 'TEXT' | 'VOICE' | 'WATCH' | 'DM'

// личный диалог (бэк: DmResponse) — channelId используется как обычный канал
export interface Dm {
  id: string // channelId
  name: string
  avatarUrl: string | null
  otherUserId: string
}

export interface User {
  id: string
  username: string
  avatarUrl: string | null
  statusMessage?: string | null
}

export interface Member {
  userId: string
  username: string
  avatarUrl: string | null
  role: Role
  status: Presence
  inVoice?: boolean
  speaking?: boolean
  joinedAt: string
  soundboardDisabled?: boolean // саундпад выключен этому участнику (даже админу)
  roleIds?: string[]           // назначенные кастомные роли (id)
}

// права как имена битов (бэк: Permission enum)
export type Permission =
  | 'VIEW_CHANNEL' | 'SEND_MESSAGES' | 'MANAGE_MESSAGES' | 'MANAGE_CHANNELS'
  | 'MANAGE_ROLES' | 'MANAGE_SERVER' | 'KICK_MEMBERS' | 'CREATE_INVITE'
  | 'MENTION_EVERYONE' | 'CONNECT' | 'ADMINISTRATOR'

// кастомная роль сервера (бэк: RoleResponse)
export interface ServerRole {
  id: string
  name: string
  color: string | null
  position: number
  permissions: Permission[]
  isDefault: boolean // @everyone
}

export type OverwriteTarget = 'ROLE' | 'MEMBER'
// перекрытие прав на канале (бэк: ChannelOverwriteResponse)
export interface ChannelOverwrite {
  id: string
  targetType: OverwriteTarget
  targetId: string
  allow: Permission[]
  deny: Permission[]
}

export interface Category {
  id: string
  name: string
  position: number
}

export interface Channel {
  id: string
  name: string
  type: ChannelType
  categoryId: string | null
  topic: string | null
  position: number
  userLimit?: number | null
  lastMessageId?: string | null
}

export interface Attachment {
  objectKey: string
  url: string
  contentType: string
  filename?: string | null
  width?: number | null
  height?: number | null
  size?: number | null
  // thumbnailUrl на бэке всегда null — превью строим по url + width/height (см. бриф)
}

// ссылка на уже загруженный объект при отправке (бэк: AttachmentInput)
export interface AttachmentInput {
  objectKey: string
  filename: string
  width?: number | null
  height?: number | null
}

export interface Reaction {
  emoji: string
  count: number
  mine: boolean
}

export interface Message {
  id: string // ULID
  channelId: string
  authorId: string
  authorName: string
  authorAvatarUrl?: string | null
  authorRole?: Role
  content: string | null
  attachments: Attachment[]
  reactions: Reaction[]
  replyToId?: string | null
  replyPreview?: { authorName: string; content: string } | null
  editedAt?: string | null
  deleted?: boolean
  pinnedAt?: string | null
  createdAt: string
  clientMessageId?: string
}

export interface ReadState {
  channelId: string
  lastReadMessageId: string | null
  mentionCount: number
}

export interface AuditEntry {
  id: string
  action: string // member.kick | member.role-change | invite.create | invite.revoke | ...
  actorName: string
  text: string
  meta: string
  createdAt: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

// Watch-party (синхронный просмотр) — /topic/watch.{id} + /app/watch.{id}.control
export type WatchAction = 'PLAY' | 'PAUSE' | 'SEEK'
export type WatchSourceKind = 'DIRECT' | 'TORRENT' | 'LINK'
// типизированный источник (бэк WatchSource, @JsonInclude(NON_NULL)); url non-null, когда source задан
export interface WatchSource {
  kind: WatchSourceKind
  url: string | null // DIRECT — прямая ссылка; TORRENT — magnet; LINK — страничный URL
  infoHash?: string | null // только TORRENT
}
// тело POST /watch/source; kind отсутствует ⇒ бэк трактует как DIRECT (legacy-совместимость)
export interface WatchSourceRequest {
  kind?: WatchSourceKind
  url?: string | null
  infoHash?: string | null
}
export interface WatchState {
  url: string | null
  paused: boolean
  positionSeconds: number
  updatedAt: number // epoch ms серверного времени
  hostId: string
  lastActionBy: string
  source?: WatchSource | null // типизированный источник (может отсутствовать у legacy-записей/стопа)
}

// Realtime-события из /topic/channel.{id} (ChatEvent @JsonInclude(NON_NULL) — присутствуют только релевантные типу поля)
export type ChatEventType =
  | 'MESSAGE_CREATED' | 'MESSAGE_EDITED' | 'MESSAGE_DELETED'
  | 'MESSAGE_PINNED' | 'MESSAGE_UNPINNED'
  | 'TYPING' | 'REACTION_ADDED' | 'REACTION_REMOVED'
export interface ChatEvent {
  type: ChatEventType
  channelId: string
  message?: Message    // есть у MESSAGE_*/PINNED; у REACTION_*/TYPING = null
  userId?: string
  username?: string
  messageId?: string   // у REACTION_*/PINNED — id целевого сообщения
  emoji?: string       // у REACTION_*
}
