import { useEffect, useState } from 'react'
import { Moon, Sun, Minus, Square, Copy, X } from 'lucide-react'
import { useTheme } from '@/theme/ThemeProvider'

const bridge = typeof window !== 'undefined' ? window.chazh : undefined

// macOS в Electron: слева — нативные «светофоры». Прячем свои кнопки и сдвигаем контент вправо.
// Детект НЕ завязан на наличие preload-моста (раньше при недоступном/незагруженном мосте отступ не
// применялся и логотип налезал на «светофоры»): Electron всегда добавляет в userAgent маркеры
// "Macintosh" и "Electron/<ver>". Считаем при каждом рендере, а не один раз на импорт модуля.
function isMacElectron(): boolean {
  if (bridge?.platform === 'darwin') return true // самый надёжный сигнал, когда preload отдал platform
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMac = /Mac/i.test(navigator.platform || ua)
  const inElectron = /Electron/i.test(ua) || !!bridge // не обычный браузер (там не прячем свои кнопки)
  return isMac && inElectron
}

export function TitleBar() {
  const { theme, toggleTheme } = useTheme()
  const mac = isMacElectron()
  // отражаем состояние «развёрнуто», чтобы иконка/подсказка кнопки переключались между развернуть/восстановить;
  // resize окна срабатывает при максимизации/восстановлении — по нему и пересинхронизируемся
  const [isMax, setIsMax] = useState(false)
  useEffect(() => {
    if (mac) return
    let alive = true
    const sync = () => { bridge?.isMaximized().then((m) => { if (alive) setIsMax(m) }).catch(() => {}) }
    sync()
    window.addEventListener('resize', sync)
    return () => { alive = false; window.removeEventListener('resize', sync) }
  }, [mac])
  return (
    <div
      className="drag"
      onDoubleClick={mac ? undefined : (e) => { if (!(e.target as HTMLElement).closest('.no-drag')) bridge?.maximize() }}
      style={{
        height: 36, flex: 'none', display: 'flex', alignItems: 'center', gap: 10,
        padding: mac ? '0 12px 0 82px' : '0 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, background: 'var(--accent)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10,
      }}>ch</div>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>chazhland</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="ib no-drag" onClick={toggleTheme} title="Сменить тему" style={{ width: 30, height: 26 }}>
          {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        {!mac && <>
          <button className="ib no-drag" onClick={() => bridge?.minimize()} title="Свернуть" style={{ width: 34, height: 26 }}><Minus size={16} /></button>
          <button className="ib no-drag" onClick={() => bridge?.maximize()} title={isMax ? 'Восстановить' : 'Развернуть'} style={{ width: 34, height: 26 }}>{isMax ? <Copy size={12} /> : <Square size={13} />}</button>
          <button
            className="no-drag"
            onClick={() => bridge?.close()}
            title="Закрыть"
            style={{ width: 34, height: 26, border: 'none', background: 'transparent', color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)' }}
          ><X size={16} /></button>
        </>}
      </div>
    </div>
  )
}
