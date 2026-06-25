import type {
  AuditEntry, Category, Channel, Member, MemberRank, Message, MyRank, RankCatalog, ReadState, ServerSummary, User,
} from '@/lib/types'

export const MOCK_USER: User = { id: 'u_me', username: 'я_дизайнер', avatarUrl: null }

export const MOCK_SERVERS: ServerSummary[] = [
  { id: 's_home', name: 'Чажленд', iconUrl: null, ownerId: 'u_anya', myRole: 'MEMBER', memberCount: 8 },
  { id: 's_squad', name: 'Сквад', iconUrl: null, ownerId: 'u_me', myRole: 'OWNER', memberCount: 3 },
]

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

// --- Ранги (mock для превью UI) ---
export const MOCK_MEMBER_RANKS: Record<string, MemberRank[]> = {
  s_home: [
    { userId: 'u_anya', level: 200, title: 'Вершина Чажленда' },
    { userId: 'u_mark', level: 140, title: 'Легенда поколения' },
    { userId: 'u_kostya', level: 95, title: 'Мастер своего дела' },
    { userId: 'u_me', level: 58, title: 'Ветеран' },
    { userId: 'u_lena', level: 22, title: 'Свой человек' },
    { userId: 'u_dmitry', level: 7, title: 'Прохожий' },
  ],
  s_squad: [
    { userId: 'u_me', level: 31, title: 'Старожил' },
    { userId: 'u_anya', level: 12, title: 'Прохожий' },
  ],
}

export const MOCK_MY_RANK: MyRank = {
  peakLevel: 58,
  peakTitle: 'Ветеран',
  servers: [
    { serverId: 's_home', level: 58, xp: 24700, title: 'Ветеран', tier: 'Ветеран', levelStartXp: 23980, nextLevelXp: 25910 },
    { serverId: 's_squad', level: 31, xp: 6300, title: 'Старожил', tier: 'Старожил', levelStartXp: 6010, nextLevelXp: 6700 },
  ],
  unlockedCosmeticIds: ['name.color.ember', 'frame.ring.gold', 'glow.soft.accent', 'frame.anim.spin', 'banner.gradient.dawn'],
}

export const MOCK_RANK_CATALOG: RankCatalog = {
  maxLevel: 220,
  levels: [
    { level: 1, title: 'Гость на пороге', tier: 'Новичок', cumulativeXp: 8 },
    { level: 7, title: 'Прохожий', tier: 'Прохожий', cumulativeXp: 230 },
    { level: 22, title: 'Свой человек', tier: 'Свой человек', cumulativeXp: 2540 },
    { level: 58, title: 'Ветеран', tier: 'Ветеран', cumulativeXp: 23980, milestone: true },
    { level: 95, title: 'Мастер своего дела', tier: 'Мастер', cumulativeXp: 78400 },
    { level: 140, title: 'Легенда поколения', tier: 'Легенда', cumulativeXp: 232000 },
    { level: 200, title: 'Вершина Чажленда', tier: 'Вершина', cumulativeXp: 750034, milestone: true },
    { level: 220, title: 'Имя, ставшее историей', tier: 'Запределье', cumulativeXp: 1057381, milestone: true },
  ],
  tiers: [
    { index: 1, name: 'Новичок', levelFrom: 1, levelTo: 5 },
    { index: 6, name: 'Ветеран', levelFrom: 49, levelTo: 64 },
    { index: 16, name: 'Запределье', levelFrom: 201, levelTo: 220 },
  ],
  cosmetics: [
    { id: 'name.color.ember', slot: 'nameEffect', unlockLevel: 1, kind: 'css', name: 'Цвет ника — уголёк' },
    { id: 'frame.ring.gold', slot: 'frame', unlockLevel: 13, kind: 'css', name: 'Золотая рамка' },
    { id: 'frame.anim.spin', slot: 'frame', unlockLevel: 49, kind: 'css', name: 'Вращающаяся рамка' },
    { id: 'profbg.upload.animated', slot: 'profileBg', unlockLevel: 200, kind: 'userUpload', name: 'Свой анимированный фон профиля' },
  ],
}

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

export const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a1', action: 'member.kick', actorName: 'Миша', text: '**Миша** исключил **Аню**', meta: 'member.kick · target: user · 01HX…3F', createdAt: '14:32, 16 июн' },
  { id: 'a2', action: 'member.role-change', actorName: 'Аня', text: '**Аня** изменила роль **Марка**', meta: 'member.role-change · { role: ADMIN }', createdAt: '12:10, 16 июн' },
  { id: 'a3', action: 'invite.create', actorName: 'Аня', text: '**Аня** создала приглашение', meta: 'invite.create · maxUses: 10', createdAt: '09:48, 15 июн' },
  { id: 'a4', action: 'invite.revoke', actorName: 'Миша', text: '**Миша** отозвал приглашение', meta: 'invite.revoke · target: invite · 01HW…A2', createdAt: '18:05, 14 июн' },
]
