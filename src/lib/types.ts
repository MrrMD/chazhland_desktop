// DTO по контракту бэка com.chazhland.messenger (см. docs/DESIGN_BRIEF.md).
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER'
export type Presence = 'online' | 'idle' | 'dnd' | 'offline'
export type ChannelType = 'TEXT' | 'VOICE' | 'WATCH' | 'DM'
export type NotificationLevel = 'ALL' | 'MENTIONS' | 'MUTED' // уровень уведомлений по каналу (бэк: NotificationLevel)

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

// сервер в гилд-рейле (бэк: ServerSummaryResponse)
export interface ServerSummary {
  id: string
  name: string
  iconUrl: string | null
  ownerId: string
  myRole: Role
  memberCount: number
}

// инвайт в списке управления (бэк: InviteResponse) — без сырого кода
export interface InviteSummary {
  id: string
  createdBy: string
  expiresAt: string | null
  maxUses: number | null
  uses: number
  revoked: boolean
  createdAt: string
}
// ответ на создание инвайта (бэк: InviteCreateResponse) — сырой код показывается один раз
export interface InviteCreated {
  code: string
  expiresAt: string | null
  maxUses: number | null
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
  statusMessage?: string | null // кастомный статус «о себе» (приходит из MemberResponse)
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
  slowModeSeconds?: number // медленный режим в секундах (0 = выкл), только текстовые
  lastMessageId?: string | null
  system?: boolean // системный канал «info»: read-only, писать может только система
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

export type MessageType = 'DEFAULT' | 'SYSTEM'

export interface Message {
  id: string // ULID
  channelId: string
  authorId: string
  type?: MessageType // SYSTEM — служебная карточка (дайджест и т.п.), рендерится отдельно
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
// результат GET /watch/search?q= (бэк WatchSearchResult, @JsonInclude(NON_NULL)):
// magnet/infoHash/codecNote могут отсутствовать; webPlayable — эвристика «сыграет ли в <video>» (иначе нужен mpv)
export interface WatchSearchResult {
  title: string
  sizeBytes: number
  seeders: number
  leechers: number
  indexer: string
  magnet?: string | null
  infoHash?: string | null
  webPlayable: boolean
  codecNote?: string | null
}

// Realtime-события из /topic/channel.{id} (ChatEvent @JsonInclude(NON_NULL) — присутствуют только релевантные типу поля)
export type ChatEventType =
  | 'MESSAGE_CREATED' | 'MESSAGE_EDITED' | 'MESSAGE_DELETED'
  | 'MESSAGE_PINNED' | 'MESSAGE_UNPINNED'
  | 'TYPING' | 'REACTION_ADDED' | 'REACTION_REMOVED'
  | 'DIGEST_PUBLISHED' // опубликована карточка дайджеста (сама карточка приходит и как MESSAGE_CREATED)
export interface ChatEvent {
  type: ChatEventType
  channelId: string
  message?: Message    // есть у MESSAGE_*/PINNED; у REACTION_*/TYPING = null
  userId?: string
  username?: string
  messageId?: string   // у REACTION_*/PINNED — id целевого сообщения; у DIGEST_PUBLISHED — id карточки
  emoji?: string       // у REACTION_*
  digestId?: string    // у DIGEST_PUBLISHED — id снапшота дайджеста
}

// ===== Дайджест активности «Чажленд Wrapped» (бэк: DigestData / DigestResponse) =====
export type DigestKind = 'WEEKLY' | 'YEARLY' | 'CUSTOM'
export interface DigestUserRef { userId: string; username: string; avatarUrl: string | null }
export interface DigestNomination { user: DigestUserRef; value: number }
export interface DigestDuo { first: DigestUserRef; second: DigestUserRef; minutes: number }
export interface DigestMessageOfWeek {
  messageId: string; channelId: string; author: DigestUserRef
  excerpt: string | null; createdAt: string; reactionCount: number
}
export interface DigestEmojiStat { emoji: string; count: number }
export interface DigestHourBucket { hour: number; count: number }
export interface DigestTotals {
  messages: number; messagesPrev: number; messagesDeltaPercent: number | null
  activeUsers: number; newcomers: number; movieNights: number
  reactions: number; voiceMinutes: number; peakHour: number | null
}
// номинации опциональны (@JsonInclude(NON_NULL) на бэке — пустые опускаются)
export interface DigestData {
  totals: DigestTotals
  chatterboxes: DigestNomination[]
  star?: DigestNomination | null
  messageOfWeek?: DigestMessageOfWeek | null
  topEmoji?: DigestEmojiStat | null
  activityByHour: DigestHourBucket[]
  newcomers: DigestUserRef[]
  nightOwl?: DigestNomination | null
  reactor?: DigestNomination | null
  necroposter?: DigestNomination | null
  voiceChampion?: DigestNomination | null
  loyalFriends?: DigestDuo | null
}
export interface DigestSummary { id: string; kind: DigestKind; periodStart: string; periodEnd: string; generatedAt: string }
export interface DigestFull extends DigestSummary { data: DigestData }
