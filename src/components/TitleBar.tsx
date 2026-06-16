import { useTheme } from '@/theme/ThemeProvider'

const bridge = typeof window !== 'undefined' ? window.chazh : undefined

export function TitleBar() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div
      className="drag"
      style={{
        height: 36, flex: 'none', display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, background: 'var(--accent)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10,
      }}>ch</div>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>chazhland</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="ib no-drag"
          onClick={toggleTheme}
          title="Сменить тему"
          style={{ width: 30, height: 26, fontSize: 14 }}
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
        <button className="ib no-drag" onClick={() => bridge?.minimize()} title="Свернуть" style={{ width: 34, height: 26 }}>–</button>
        <button className="ib no-drag" onClick={() => bridge?.maximize()} title="Развернуть" style={{ width: 34, height: 26, fontSize: 11 }}>▢</button>
        <button
          className="no-drag"
          onClick={() => bridge?.close()}
          title="Закрыть"
          style={{
            width: 34, height: 26, border: 'none', background: 'transparent', color: 'var(--text-2)',
            borderRadius: 7, cursor: 'pointer', fontSize: 13,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
        >✕</button>
      </div>
    </div>
  )
}
