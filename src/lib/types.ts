// DTO по контракту бэка com.chazhland.messenger (см. docs/DESIGN_BRIEF.md).
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type Presence = 'online' | 'idle' | 'dnd' | 'offline'
export type ChannelType = 'TEXT' | 'VOICE' | 'WATCH'

export interface User {
  id: string
  username: string
  avatarUrl: string | null
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
  width?: number | null
  height?: number | null
  size?: number | null
  // thumbnailUrl на бэке всегда null — превью строим по url + width/height (см. бриф)
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
  authorRole?: Role
  content: string | null
  attachments: Attachment[]
  reactions: Reaction[]
  replyToId?: string | null
  replyPreview?: { authorName: string; content: string } | null
  editedAt?: string | null
  deleted?: boolean
  createdAt: string
  clientMessageId?: string
}

export interface ReadState {
  channelId: string
  lastReadMessageId: string | null
  mentionCount: number
}

export type InviteStatus = 'active' | 'exhausted' | 'expired' | 'revoked'
export interface Invite {
  id: string
  code?: string // приходит ТОЛЬКО при создании
  maxUses: number | null
  uses: number
  expiresAt: string | null
  revoked: boolean
  createdBy: string
  createdAt: string
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
export interface WatchState {
  url: string | null
  paused: boolean
  positionSeconds: number
  updatedAt: number // epoch ms серверного времени
  hostId: string
  lastActionBy: string
}

// Realtime-события из /topic/channel.{id}
export type ChatEventType = 'MESSAGE_CREATED' | 'MESSAGE_EDITED' | 'MESSAGE_DELETED' | 'TYPING' | 'REACTION'
export interface ChatEvent {
  type: ChatEventType
  channelId: string
  message?: Message
  userId?: string
}
