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
    { userId: 'u_anya', level: 200, title: 'Вершина Чажленда', equipped: { frame: 'frame.anim.spin', glow: 'glow.aura.rainbow', nameEffect: 'name.anim.holo', profileBg: 'profbg.particle.snow', badge: 'badge.tier.11', msgAccent: 'msgaccent.glowname' } },
    { userId: 'u_mark', level: 140, title: 'Легенда поколения', equipped: { frame: 'frame.anim.shimmerGold', glow: 'glow.pulse.breath', nameEffect: 'name.anim.shimmer', badge: 'badge.tier.6', msgAccent: 'msgaccent.bar.solid' } },
    { userId: 'u_kostya', level: 95, title: 'Мастер своего дела', equipped: { frame: 'frame.ring.gold', glow: 'glow.warm.ember', nameEffect: 'name.gradient.sunset' } },
    { userId: 'u_me', level: 58, title: 'Ветеран', equipped: { frame: 'frame.anim.spin', glow: 'glow.soft.accent', nameEffect: 'name.gradient.sunset', profileBg: 'profbg.canvas.nebula', badge: 'badge.founder', msgAccent: 'msgaccent.bar.gradient' } },
    { userId: 'u_lena', level: 22, title: 'Свой человек', equipped: { frame: 'frame.ring.bronze', nameEffect: 'name.color.azure' } },
    { userId: 'u_dmitry', level: 7, title: 'Прохожий' },
  ],
  s_squad: [
    { userId: 'u_me', level: 31, title: 'Старожил', equipped: { frame: 'frame.anim.spin', glow: 'glow.soft.accent', nameEffect: 'name.gradient.sunset' } },
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
  // mock — «прокачанный» аккаунт: открыто всё (чтобы было видно весь каталог экипировки/фоны)
  unlockedCosmeticIds: [
    'name.color.ember', 'name.color.rose', 'name.color.azure', 'name.gradient.sunset', 'name.anim.shimmer', 'name.anim.holo',
    'frame.ring.bronze', 'frame.ring.silver', 'frame.ring.gold', 'frame.gradient.aurora', 'frame.anim.spin', 'frame.anim.shimmerGold',
    'glow.soft.accent', 'glow.warm.ember', 'glow.pulse.breath', 'glow.aura.rainbow',
    'profbg.gradient.flow', 'profbg.particle.snow', 'profbg.particle.sakura', 'profbg.canvas.nebula', 'profbg.holo.foil', 'profbg.upload.image', 'profbg.upload.animated',
    'badge.founder', 'badge.tier.6', 'badge.tier.11',
    'banner.gradient.dawn', 'banner.anim.gradient', 'banner.particle.stars',
    'msgaccent.bar.solid', 'msgaccent.bar.gradient', 'msgaccent.glowname',
  ],
  equipped: { frame: 'frame.anim.spin', glow: 'glow.soft.accent', nameEffect: 'name.gradient.sunset', profileBg: 'profbg.canvas.nebula', badge: 'badge.founder', msgAccent: 'msgaccent.bar.gradient' },
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
  // подмножество каталога бэка (ranks.json) — достаточно для витрины экипировки
  cosmetics: [
    // эффект ника
    { id: 'name.color.ember', slot: 'nameEffect', unlockLevel: 1, kind: 'css', name: 'Цвет ника — уголёк' },
    { id: 'name.color.rose', slot: 'nameEffect', unlockLevel: 2, kind: 'css', name: 'Цвет ника — роза' },
    { id: 'name.color.azure', slot: 'nameEffect', unlockLevel: 3, kind: 'css', name: 'Цвет ника — лазурь' },
    { id: 'name.gradient.sunset', slot: 'nameEffect', unlockLevel: 23, kind: 'css', name: 'Градиентный ник — закат' },
    { id: 'name.anim.shimmer', slot: 'nameEffect', unlockLevel: 65, kind: 'css', name: 'Мерцающий ник' },
    { id: 'name.anim.holo', slot: 'nameEffect', unlockLevel: 185, kind: 'css', name: 'Голографический ник' },
    // рамка аватара
    { id: 'frame.ring.bronze', slot: 'frame', unlockLevel: 6, kind: 'css', name: 'Бронзовая рамка' },
    { id: 'frame.ring.silver', slot: 'frame', unlockLevel: 9, kind: 'css', name: 'Серебряная рамка' },
    { id: 'frame.ring.gold', slot: 'frame', unlockLevel: 13, kind: 'css', name: 'Золотая рамка' },
    { id: 'frame.gradient.aurora', slot: 'frame', unlockLevel: 35, kind: 'css', name: 'Градиентная рамка «аврора»' },
    { id: 'frame.anim.spin', slot: 'frame', unlockLevel: 49, kind: 'css', name: 'Вращающаяся рамка' },
    { id: 'frame.anim.shimmerGold', slot: 'frame', unlockLevel: 83, kind: 'css', name: 'Мерцающая золотая рамка' },
    // свечение
    { id: 'glow.soft.accent', slot: 'glow', unlockLevel: 6, kind: 'css', name: 'Мягкое свечение (акцент)' },
    { id: 'glow.warm.ember', slot: 'glow', unlockLevel: 23, kind: 'css', name: 'Тёплое свечение' },
    { id: 'glow.pulse.breath', slot: 'glow', unlockLevel: 49, kind: 'css', name: 'Дышащая аура' },
    { id: 'glow.aura.rainbow', slot: 'glow', unlockLevel: 155, kind: 'css', name: 'Радужная аура' },
    // фон профиля (витрина «потолка») — css/частицы/canvas/голограмма/загрузка
    { id: 'profbg.gradient.flow', slot: 'profileBg', unlockLevel: 65, kind: 'css', name: 'Фон профиля — анимированный градиент' },
    { id: 'profbg.particle.snow', slot: 'profileBg', unlockLevel: 101, kind: 'cssParticle', name: 'Фон профиля — снег' },
    { id: 'profbg.particle.sakura', slot: 'profileBg', unlockLevel: 119, kind: 'cssParticle', name: 'Фон профиля — сакура' },
    { id: 'profbg.canvas.nebula', slot: 'profileBg', unlockLevel: 155, kind: 'canvas', name: 'Фон профиля — туманность' },
    { id: 'profbg.holo.foil', slot: 'profileBg', unlockLevel: 171, kind: 'parallax', name: 'Фон профиля — голограмма/фольга' },
    { id: 'profbg.upload.image', slot: 'profileBg', unlockLevel: 195, kind: 'userUpload', name: 'Своя картинка на фон профиля' },
    { id: 'profbg.upload.animated', slot: 'profileBg', unlockLevel: 200, kind: 'userUpload', name: 'Свой анимированный фон профиля' },
    // бейджи
    { id: 'badge.founder', slot: 'badge', unlockLevel: 0, kind: 'css', name: 'Бейдж «Основатель»' },
    { id: 'badge.tier.6', slot: 'badge', unlockLevel: 64, kind: 'css', name: 'Бейдж тира «Ветеран»' },
    { id: 'badge.tier.11', slot: 'badge', unlockLevel: 154, kind: 'css', name: 'Бейдж тира «Легенда»' },
    // баннеры профиля
    { id: 'banner.gradient.dawn', slot: 'banner', unlockLevel: 49, kind: 'css', name: 'Баннер — рассвет (градиент)' },
    { id: 'banner.anim.gradient', slot: 'banner', unlockLevel: 83, kind: 'css', name: 'Баннер — плывущий градиент' },
    { id: 'banner.particle.stars', slot: 'banner', unlockLevel: 119, kind: 'cssParticle', name: 'Баннер — звёздное поле' },
    // акцент сообщений
    { id: 'msgaccent.bar.solid', slot: 'msgAccent', unlockLevel: 83, kind: 'css', name: 'Акцентная полоса у сообщений' },
    { id: 'msgaccent.bar.gradient', slot: 'msgAccent', unlockLevel: 137, kind: 'css', name: 'Градиентная полоса у сообщений' },
    { id: 'msgaccent.glowname', slot: 'msgAccent', unlockLevel: 171, kind: 'css', name: 'Свечение имени в сообщениях' },
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
