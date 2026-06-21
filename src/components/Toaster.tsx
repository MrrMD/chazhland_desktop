import { useEffect, useState } from 'react'
import { toast, type Toast } from '@/lib/toast'

type Rendered = Toast & { leaving?: boolean }

export function Toaster() {
  // держим собственный список, чтобы доиграть exit-анимацию (toastOut) тостам, ушедшим из источника
  const [rendered, setRendered] = useState<Rendered[]>([])

  useEffect(() => toast.subscribe((items) => {
    setRendered((prev) => {
      const ids = new Set(items.map((i) => i.id))
      const kept = prev.map((p) => (ids.has(p.id) ? { ...p, leaving: false } : { ...p, leaving: true }))
      const added = items.filter((i) => !prev.some((p) => p.id === i.id))
      return [...kept, ...added]
    })
  }), [])

  // снимаем отыгравшие тосты из DOM после анимации выезда
  useEffect(() => {
    if (!rendered.some((r) => r.leaving)) return
    const t = window.setTimeout(() => setRendered((r) => r.filter((x) => !x.leaving)), 220)
    return () => window.clearTimeout(t)
  }, [rendered])

  return (
    <div style={{ position: 'fixed', top: 44, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {rendered.map((t) => (
        <div
          key={t.id}
          onClick={() => toast.dismiss(t.id)}
          style={{
            pointerEvents: 'auto', cursor: 'pointer', minWidth: 240, maxWidth: 380,
            padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#fff',
            background: t.kind === 'error' ? 'var(--danger)' : t.kind === 'ok' ? 'var(--green)' : 'var(--accent)',
            boxShadow: '0 12px 32px -10px rgba(0,0,0,.55)',
            animation: t.leaving ? 'toastOut .2s ease forwards' : 'mdIn .25s ease',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
