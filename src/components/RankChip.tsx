import { hexA } from '@/theme/themes'
import { rankColor } from '@/lib/ranks'

/**
 * Пилюля ранга у ника: «ур.N» (compact) или «ур.N · звание». Тинт по тир-цвету уровня; стиль 1:1 с
 * бейджами ролей. Полное звание — всегда в тултипе.
 */
export function RankChip({ level, title, compact }: { level: number; title?: string | null; compact?: boolean }) {
  if (!level || level < 1) return null
  const c = rankColor(level)
  const label = compact || !title ? `ур.${level}` : `ур.${level} · ${title}`
  return (
    <span
      title={title ? `${title} · ур. ${level}` : `ур. ${level}`}
      style={{
        flex: 'none', fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '1px 7px', whiteSpace: 'nowrap',
        background: hexA(c, 0.16), color: c,
        maxWidth: compact ? undefined : 170, overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >{label}</span>
  )
}
