// Человеческие метки прав для UI ролей/каналов. Порядок и группировка — как удобно админу читать.
import type { Permission } from './types'

export interface PermMeta { key: Permission; label: string; desc: string; group: string }

export const PERMISSIONS: PermMeta[] = [
  { key: 'VIEW_CHANNEL', label: 'Просматривать каналы', desc: 'Видеть и читать канал', group: 'Основные' },
  { key: 'SEND_MESSAGES', label: 'Отправлять сообщения', desc: 'Писать в текстовых каналах', group: 'Основные' },
  { key: 'MENTION_EVERYONE', label: 'Упоминать @everyone', desc: 'Использовать @everyone и @here', group: 'Основные' },
  { key: 'CONNECT', label: 'Подключаться к голосу', desc: 'Заходить в голосовые и совместный просмотр', group: 'Голос' },
  { key: 'MANAGE_MESSAGES', label: 'Управлять сообщениями', desc: 'Удалять чужие сообщения, закреплять', group: 'Модерация' },
  { key: 'KICK_MEMBERS', label: 'Исключать участников', desc: 'Удалять участников с сервера', group: 'Модерация' },
  { key: 'CREATE_INVITE', label: 'Создавать приглашения', desc: 'Выдавать инвайт-коды', group: 'Модерация' },
  { key: 'MANAGE_CHANNELS', label: 'Управлять каналами', desc: 'Создавать, править и удалять каналы и категории', group: 'Управление' },
  { key: 'MANAGE_ROLES', label: 'Управлять ролями', desc: 'Создавать роли и настраивать доступ к каналам', group: 'Управление' },
  { key: 'MANAGE_SERVER', label: 'Управлять сервером', desc: 'Имя/иконка сервера, эмодзи', group: 'Управление' },
  { key: 'ADMINISTRATOR', label: 'Администратор', desc: 'Все права без ограничений. Выдавайте осторожно.', group: 'Особые' },
]

export const PERM_GROUPS = ['Основные', 'Голос', 'Модерация', 'Управление', 'Особые'] as const

// палитра для ролей (Discord-подобная)
export const ROLE_COLORS = ['#5865f2', '#23a55a', '#f0b232', '#da373c', '#e0457b', '#7c5cff', '#3a78c2', '#13b886', '#ff6b4a', '#949ba4'] as const
export const DEFAULT_ROLE_COLOR = '#949ba4'
