import { badgeMeta } from '@/lib/cosmetics'

/** Эмблема-бейдж у ника (косметика слота badge): основатель/тир/прочее. Null, если ничего не надето. */
export function RankBadge({ id, size = 15 }: { id?: string; size?: number }) {
  const m = badgeMeta(id)
  if (!m) return null
  return (
    <span
      title="Бейдж"
      style={{
        flex: 'none', width: size, height: size, borderRadius: 4, background: m.bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.62, fontWeight: 800, color: '#fff', lineHeight: 1,
        textShadow: '0 1px 1px rgba(0,0,0,.35)',
      }}
    >{m.glyph}</span>
  )
}
