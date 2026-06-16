import { useEffect } from 'react'

// Закрытие оверлея по Escape. active=false отключает (напр., когда поверх открыт вложенный модал).
export function useEscape(onEsc: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onEsc() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onEsc, active])
}
