import type { CSSProperties } from 'react'

/**
 * Косметика-рамка: слой-кольцо вокруг аватара (на 3px больше внутреннего круга, под ним по z — видно
 * только кольцо). Статичные/градиентные/анимированные (spin/shimmer) по id из каталога рангов.
 * Возвращает стиль слоя или null. Эффекты — на @keyframes из global.css (spin, shimmer, live).
 */
export function frameLayer(id?: string): CSSProperties | null {
  if (!id) return null
  const ring = (background: string, animation?: string): CSSProperties => ({
    position: 'absolute', inset: -3, borderRadius: '50%', zIndex: 0, background, ...(animation ? { animation } : {}),
  })
  switch (id) {
    case 'frame.ring.bronze': return ring('#cd7f32')
    case 'frame.ring.silver': return ring('#c4c8cc')
    case 'frame.ring.gold': return ring('#e7c14b')
    case 'frame.gradient.aurora': return ring('linear-gradient(135deg,#5b6cff,#13b886)')
    case 'frame.anim.spin': return ring('conic-gradient(from 0deg,#5b6cff,#13b886,#e0457b,#e7c14b,#5b6cff)', 'spin 6s linear infinite')
    case 'frame.anim.shimmerGold': return { ...ring('linear-gradient(90deg,#a06a14,#fff3c0,#e7c14b,#a06a14)'), backgroundSize: '420px 100%', animation: 'shimmer 2.6s linear infinite' }
    default:
      if (id.startsWith('frame.anim')) return ring('conic-gradient(from 0deg,#5b6cff,#e0457b,#e7c14b,#5b6cff)', 'spin 6s linear infinite')
      if (id.startsWith('frame.gradient')) return ring('linear-gradient(135deg,#5b6cff,#13b886)')
      if (id.startsWith('frame')) return ring('#e7c14b')
      return null
  }
}

/**
 * Косметика-эффект ника: стиль для текста имени (цвет / градиент / анимированный градиент).
 * Градиентные варианты используют background-clip:text. Возвращает стиль или null.
 */
export function nameStyle(id?: string): CSSProperties | null {
  if (!id) return null
  const grad = (background: string, animation?: string): CSSProperties => ({
    background, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent',
    ...(animation ? { backgroundSize: '420px 100%', animation } : {}),
  })
  switch (id) {
    case 'name.color.ember': return { color: '#f0a23a' }
    case 'name.color.rose': return { color: '#e0457b' }
    case 'name.color.azure': return { color: '#2bb3ff' }
    case 'name.gradient.sunset': return grad('linear-gradient(90deg,#ff8a3a,#e0457b,#a855f7)')
    case 'name.anim.shimmer': return grad('linear-gradient(90deg,#a06a14,#fff3c0,#e7c14b,#a06a14)', 'shimmer 2.6s linear infinite')
    case 'name.anim.liquid': return grad('linear-gradient(90deg,#9aa3ad,#fff,#9aa3ad,#5b6470)', 'shimmer 3.4s linear infinite')
    case 'name.anim.holo': return grad('linear-gradient(90deg,#5b6cff,#13b886,#e0457b,#e7c14b,#5b6cff)', 'shimmer 3s linear infinite')
    default:
      if (id.startsWith('name.anim')) return grad('linear-gradient(90deg,#5b6cff,#e0457b,#e7c14b,#5b6cff)', 'shimmer 3s linear infinite')
      if (id.startsWith('name.gradient')) return grad('linear-gradient(90deg,#ff8a3a,#e0457b,#a855f7)')
      if (id.startsWith('name.color')) return { color: 'var(--accent)' }
      return null
  }
}

/** Человекочитаемые названия слотов косметики (для группировки в экипировке). */
export const SLOT_LABELS: Record<string, string> = {
  frame: 'Рамка аватара',
  glow: 'Свечение',
  nameEffect: 'Эффект ника',
  badge: 'Бейдж',
  banner: 'Баннер профиля',
  profileBg: 'Фон профиля',
  msgAccent: 'Акцент сообщений',
}
/** Порядок отображения слотов в экипировке (сначала то, что видно на аватаре/нике). */
export const SLOT_ORDER = ['frame', 'glow', 'nameEffect', 'badge', 'banner', 'profileBg', 'msgAccent']

/** Косметика-свечение: ореол/аура под аватаром (box-shadow или размытый conic-halo). */
export function glowLayer(id?: string): CSSProperties | null {
  if (!id) return null
  const halo = (boxShadow: string, animation?: string): CSSProperties => ({
    position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 0, pointerEvents: 'none', boxShadow, ...(animation ? { animation } : {}),
  })
  switch (id) {
    case 'glow.soft.accent': return halo('0 0 13px 1px rgba(88,101,242,.6)')
    case 'glow.warm.ember': return halo('0 0 16px 2px rgba(240,162,58,.55)')
    case 'glow.pulse.breath': return halo('0 0 17px 2px rgba(224,69,123,.6)', 'live 2.4s ease-in-out infinite')
    case 'glow.aura.rainbow': return {
      position: 'absolute', inset: -5, borderRadius: '50%', zIndex: 0, pointerEvents: 'none',
      background: 'conic-gradient(from 0deg,#5b6cff,#13b886,#e0457b,#e7c14b,#5b6cff)', filter: 'blur(7px)', opacity: 0.7, animation: 'spin 5s linear infinite',
    }
    default:
      if (id.startsWith('glow')) return halo('0 0 13px 1px rgba(88,101,242,.55)')
      return null
  }
}
