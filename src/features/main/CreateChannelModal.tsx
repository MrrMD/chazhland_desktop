import { useState } from 'react'
import { Modal } from '@/components/Modal'
import type { ChannelType } from '@/lib/types'

const TYPES: { type: ChannelType; icon: string; label: string; desc: string }[] = [
  { type: 'TEXT', icon: '#', label: 'Текстовый', desc: 'переписка' },
  { type: 'VOICE', icon: '🔊', label: 'Голосовой', desc: 'звонок + экран' },
  { type: 'WATCH', icon: '▶', label: 'Кинозал', desc: 'совместный просмотр' },
]

export function CreateChannelModal({ onCreate, onClose }: {
  onCreate: (p: { name: string; type: ChannelType }) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ChannelType>('TEXT')
  const [loading, setLoading] = useState(false)

  async function submit() {
    const n = name.trim()
    if (!n) return
    setLoading(true)
    try { await onCreate({ name: n, type }); onClose() } catch { /* TODO toast */ } finally { setLoading(false) }
  }

  return (
    <Modal title="Создать канал" onClose={onClose}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Тип</label>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
        {TYPES.map((t) => (
          <button key={t.type} onClick={() => setType(t.type)} className="no-drag" style={{ flex: 1, textAlign: 'left', border: `1.5px solid ${type === t.type ? 'var(--accent)' : 'var(--border)'}`, background: type === t.type ? 'var(--accent-tint)' : 'var(--surface)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', color: type === t.type ? 'var(--accent)' : 'var(--text)' }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{t.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.desc}</div>
          </button>
        ))}
      </div>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Название</label>
      <div className="field" style={{ padding: '11px 14px', margin: '7px 0 18px' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="например, общий" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="pill no-drag" onClick={onClose} style={{ padding: '10px 16px', fontWeight: 600 }}>Отмена</button>
        <button className="accent-btn no-drag" disabled={loading || !name.trim()} onClick={submit} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700, opacity: !name.trim() ? 0.5 : 1 }}>{loading ? 'Создаём…' : 'Создать'}</button>
      </div>
    </Modal>
  )
}
