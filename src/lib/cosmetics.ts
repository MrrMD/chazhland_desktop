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
