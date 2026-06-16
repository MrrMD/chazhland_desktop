// Плейсхолдер-загрузка (shimmer). Класс .skel — в global.css.
export function Skeleton({ w, h = 12, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <span className="skel" style={{ display: 'block', width: w ?? '100%', height: h, borderRadius: r, ...style }} />
}

// Строка-скелет «аватар + две линии» — для лент сообщений/участников.
export function SkeletonRow({ avatar = 38, lines = 2 }: { avatar?: number; lines?: number }) {
  return (
    <div style={{ display: 'flex', gap: 11, padding: '8px 6px', alignItems: 'center' }}>
      <Skeleton w={avatar} h={avatar} r={avatar} style={{ flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton w="40%" h={11} />
        {lines > 1 && <Skeleton w="72%" h={11} />}
      </div>
    </div>
  )
}
