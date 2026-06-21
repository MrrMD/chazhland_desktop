import type { Presence } from '@/lib/types'

const GRADS = [
  'linear-gradient(135deg,#f0a23a,#e0457b)',
  'linear-gradient(135deg,#5b6cff,#7c5cff)',
  'linear-gradient(135deg,#2faa6a,#13b886)',
  'linear-gradient(135deg,#e0457b,#7c5cff)',
  'linear-gradient(135deg,#3a78c2,#13b886)',
  'linear-gradient(135deg,#ff6b4a,#e0457b)',
]

export function gradFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return GRADS[h % GRADS.length]
}

export function presenceColor(s: Presence): string {
  switch (s) {
    case 'online': return 'var(--green)'
    case 'idle': return 'var(--idle)'
    case 'dnd': return 'var(--danger)'
    default: return 'var(--text-3)'
  }
}

export function Avatar({
  name, src, size = 40, presence, dim = false, ringColor, speaking = false,
}: {
  name: string
  src?: string | null
  size?: number
  presence?: Presence
  dim?: boolean
  ringColor?: string
  speaking?: boolean // активный спикер — пульсирующее зелёное кольцо (keyframe ring)
}) {
  const dot = Math.max(10, Math.round(size * 0.3))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none', opacity: dim ? 0.45 : 1 }}>
      <div
        style={{
          width: size, height: size, borderRadius: '50%', background: gradFor(name),
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: Math.round(size * 0.38), overflow: 'hidden',
          // говорит → пульс-кольцо (ring анимирует box-shadow); иначе статичное кольцо ringColor
          boxShadow: !speaking && ringColor ? `0 0 0 2px ${ringColor}` : undefined,
          animation: speaking ? 'ring 1.5s ease-out infinite' : undefined,
        }}
      >
        {src
          ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : name.slice(0, 1).toUpperCase()}
      </div>
      {presence && presence !== 'offline' && (
        <div
          style={{
            position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: '50%',
            background: presenceColor(presence), border: '2.5px solid var(--surface)',
            transition: 'background .3s ease', // плавная смена цвета статуса (online↔idle↔dnd)
          }}
        />
      )}
    </div>
  )
}
