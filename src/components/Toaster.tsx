import { useEffect, useState } from 'react'
import { toast, type Toast } from '@/lib/toast'

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => toast.subscribe(setItems), [])

  return (
    <div style={{ position: 'fixed', top: 44, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => toast.dismiss(t.id)}
          style={{
            pointerEvents: 'auto', cursor: 'pointer', minWidth: 240, maxWidth: 380,
            padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 500, color: '#fff',
            background: t.kind === 'error' ? 'var(--danger)' : t.kind === 'ok' ? 'var(--green)' : 'var(--accent)',
            boxShadow: '0 12px 32px -10px rgba(0,0,0,.55)', animation: 'mdIn .25s ease',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
