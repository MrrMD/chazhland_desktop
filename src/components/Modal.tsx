import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children, width = 440 }: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(20,17,14,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 22px', animation: 'ovIn .2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: '100%', background: 'var(--win)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 40px 90px -20px rgba(0,0,0,.55)', animation: 'mdIn .32s cubic-bezier(.22,.61,.36,1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{title}</span>
          <button className="ib no-drag" onClick={onClose} style={{ marginLeft: 'auto', width: 32, height: 32, background: 'var(--surface-2)' }}><X size={15} /></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}
