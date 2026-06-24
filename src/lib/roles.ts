import type { ServerRole } from './types'

// Высшая назначенная участнику кастомная роль (по position; @everyone/default не считаем) — для бейджа.
export function highestRole(roleIds: string[] | undefined, roles: ServerRole[]): ServerRole | null {
  if (!roleIds || roleIds.length === 0 || roles.length === 0) return null
  const assigned = roles.filter((r) => !r.isDefault && roleIds.includes(r.id))
  if (assigned.length === 0) return null
  return assigned.reduce((a, b) => (b.position > a.position ? b : a))
}

// Цвет ника = высшая по position роль с заданным цветом (как в Discord).
export function roleColor(roleIds: string[] | undefined, roles: ServerRole[]): string | null {
  if (!roleIds || roleIds.length === 0 || roles.length === 0) return null
  const colored = roles.filter((r) => !r.isDefault && r.color && roleIds.includes(r.id))
  if (colored.length === 0) return null
  return colored.reduce((a, b) => (b.position > a.position ? b : a)).color
}
