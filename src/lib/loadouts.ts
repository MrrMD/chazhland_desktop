/**
 * Пресеты косметики («образы») — сохранённые комбо экипировки, переключаются в один клик. Личная
 * пер-машинная штука → храним в localStorage (ключ по userId), применяем через обычный equip-API.
 * Серверная синхронизация — возможный follow-up.
 */
export interface Loadout {
  id: string
  name: string
  equipped: Record<string, string> // слот → cosmeticId
}

const key = (userId: string) => `chazh.loadouts.${userId}`

export const loadouts = {
  list(userId: string): Loadout[] {
    try {
      const raw = localStorage.getItem(key(userId))
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  },
  save(userId: string, name: string, equipped: Record<string, string>): Loadout[] {
    const lo: Loadout = { id: 'lo_' + Date.now().toString(36), name: name.trim() || 'Образ', equipped: { ...equipped } }
    const next = [...this.list(userId), lo]
    try { localStorage.setItem(key(userId), JSON.stringify(next)) } catch { /* квота */ }
    return next
  },
  remove(userId: string, id: string): Loadout[] {
    const next = this.list(userId).filter((l) => l.id !== id)
    try { localStorage.setItem(key(userId), JSON.stringify(next)) } catch { /* */ }
    return next
  },
}
