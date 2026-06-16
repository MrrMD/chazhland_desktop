import type {
  AuditEntry, Category, Channel, Invite, Member, Message, ReadState, User,
} from '@/lib/types'

export const MOCK_USER: User = { id: 'u_me', username: 'я_дизайнер', avatarUrl: null }

export const MOCK_CATEGORIES: Category[] = [
  { id: 'c_text', name: 'Текстовые', position: 0 },
  { id: 'c_voice', name: 'Голосовые', position: 1 },
  { id: 'c_cinema', name: 'Кинотеатр', position: 2 },
]

export const MOCK_CHANNELS: Channel[] = [
  { id: 'ch_general', name: 'общий', type: 'TEXT', categoryId: 'c_text', topic: 'главный канал команды', position: 0 },
  { id: 'ch_design', name: 'дизайн', type: 'TEXT', categoryId: 'c_text', topic: 'макеты и ревью', position: 1 },
  { id: 'ch_releases', name: 'релизы', type: 'TEXT', categoryId: 'c_text', topic: null, position: 2 },
  { id: 'ch_random', name: 'random', type: 'TEXT', categoryId: 'c_text', topic: null, position: 3 },
  { id: 'ch_call', name: 'созвон', type: 'VOICE', categoryId: 'c_voice', topic: null, position: 0, userLimit: 10 },
  { id: 'ch_cs', name: 'CS 2', type: 'VOICE', categoryId: 'c_voice', topic: null, position: 1, userLimit: 5 },
  { id: 'ch_music', name: 'music', type: 'VOICE', categoryId: 'c_voice', topic: null, position: 2 },
  { id: 'ch_hall', name: 'кинозал', type: 'WATCH', categoryId: 'c_cinema', topic: null, position: 0 },
  { id: 'ch_premiere', name: 'премьеры', type: 'WATCH', categoryId: 'c_cinema', topic: null, position: 1 },
]

export const MOCK_MEMBERS: Member[] = [
  { userId: 'u_anya', username: 'Аня', avatarUrl: null, role: 'OWNER', status: 'online', inVoice: true, speaking: true, joinedAt: '2026-03-12' },
  { userId: 'u_kostya', username: 'kostya', avatarUrl: null, role: 'MEMBER', status: 'online', inVoice: true, speaking: true, joinedAt: '2026-04-02' },
  { userId: 'u_mark', username: 'Марк', avatarUrl: null, role: 'ADMIN', status: 'online', joinedAt: '2026-03-18' },
  { userId: 'u_me', username: 'я_дизайнер', avatarUrl: null, role: 'MEMBER', status: 'online', inVoice: true, joinedAt: '2026-05-01' },
  { userId: 'u_lena', username: 'Лена', avatarUrl: null, role: 'MEMBER', status: 'idle', joinedAt: '2026-04-05' },
  { userId: 'u_dmitry', username: 'dmitry', avatarUrl: null, role: 'MEMBER', status: 'offline', joinedAt: '2026-04-20' },
]

export const MOCK_MESSAGES: Record<string, Message[]> = {
  ch_general: [
    {
      id: '01HX0001', channelId: 'ch_general', authorId: 'u_anya', authorName: 'Аня', authorRole: 'OWNER',
      content: 'залила макет шапки канала — гляньте, нормально читается крупным кеглем?',
      attachments: [{ objectKey: 'k1', url: '', contentType: 'image/png', width: 1280, height: 720 }],
      reactions: [{ emoji: '👍', count: 4, mine: true }, { emoji: '🔥', count: 2, mine: false }],
      createdAt: '2026-06-16T14:02:00Z',
    },
    {
      id: '01HX0002', channelId: 'ch_general', authorId: 'u_mark', authorName: 'Марк', authorRole: 'ADMIN',
      content: 'огонь 🔥 только отступы бы покрупнее сделать', attachments: [], reactions: [],
      replyToId: '01HX0001', replyPreview: { authorName: 'Аня', content: 'залила макет шапки канала…' },
      editedAt: '2026-06-16T14:06:00Z', createdAt: '2026-06-16T14:05:00Z',
    },
    {
      id: '01HX0003', channelId: 'ch_general', authorId: 'u_kostya', authorName: 'kostya',
      content: '@everyone созвон через 10 минут в голосовом 🎧', attachments: [], reactions: [],
      createdAt: '2026-06-16T14:07:00Z',
    },
  ],
}

export const MOCK_READ_STATES: ReadState[] = [
  { channelId: 'ch_general', lastReadMessageId: '01HX0002', mentionCount: 1 },
  { channelId: 'ch_design', lastReadMessageId: null, mentionCount: 0 },
]

export const MOCK_INVITES: Invite[] = [
  { id: 'i1', maxUses: 10, uses: 3, expiresAt: '2026-06-30', revoked: false, createdBy: 'Аня', createdAt: '2026-06-14' },
  { id: 'i2', maxUses: null, uses: 5, expiresAt: null, revoked: false, createdBy: 'Марк', createdAt: '2026-06-10' },
  { id: 'i3', maxUses: 10, uses: 10, expiresAt: null, revoked: false, createdBy: 'Аня', createdAt: '2026-06-01' },
  { id: 'i4', maxUses: 5, uses: 0, expiresAt: '2026-05-28', revoked: false, createdBy: 'Марк', createdAt: '2026-05-20' },
]

export const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a1', action: 'member.kick', actorName: 'Миша', text: '**Миша** исключил **Аню**', meta: 'member.kick · target: user · 01HX…3F', createdAt: '14:32, 16 июн' },
  { id: 'a2', action: 'member.role-change', actorName: 'Аня', text: '**Аня** изменила роль **Марка**', meta: 'member.role-change · { role: ADMIN }', createdAt: '12:10, 16 июн' },
  { id: 'a3', action: 'invite.create', actorName: 'Аня', text: '**Аня** создала приглашение', meta: 'invite.create · maxUses: 10', createdAt: '09:48, 15 июн' },
  { id: 'a4', action: 'invite.revoke', actorName: 'Миша', text: '**Миша** отозвал приглашение', meta: 'invite.revoke · target: invite · 01HW…A2', createdAt: '18:05, 14 июн' },
]
