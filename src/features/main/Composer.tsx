import { useRef, useState } from 'react'
import { Plus, Smile, Send, X } from 'lucide-react'

export function Composer({ channelName, onSend, onType, replyToName, onCancelReply }: {
  channelName: string
  onSend: (text: string) => void
  onType?: () => void
  replyToName?: string | null
  onCancelReply?: () => void
}) {
  const [text, setText] = useState('')
  const lastTyped = useRef(0)
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
    // throttle: не чаще раза в 3 с (бэк шлёт ephemeral TYPING, без хранения)
    const now = Date.now()
    if (e.target.value && now - lastTyped.current > 3000) { lastTyped.current = now; onType?.() }
  }
  return (
    <form onSubmit={submit} style={{ padding: '8px 26px 18px', flex: 'none' }}>
      {replyToName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', padding: '6px 14px', marginBottom: -1 }}>
          Ответ <b style={{ fontWeight: 600, color: 'var(--text)' }}>{replyToName}</b>
          <button type="button" className="ib no-drag" onClick={onCancelReply} title="Отменить ответ" style={{ marginLeft: 'auto', width: 22, height: 20 }}><X size={13} /></button>
        </div>
      )}
      <div className="field" style={{ borderRadius: replyToName ? '0 0 16px 16px' : 16, border: '1px solid var(--border)', background: 'var(--surface)', padding: '11px 14px 11px 16px', gap: 12 }}>
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)' }} title="Вложение"><Plus size={18} /></button>
        <input value={text} onChange={onChange} placeholder={`Написать в #${channelName}…`} style={{ fontSize: 14.5 }} />
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32 }} title="Эмодзи"><Smile size={18} /></button>
        <button type="submit" className="accent-btn" style={{ width: 40, height: 40, borderRadius: 12, boxShadow: '0 4px 12px var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Отправить"><Send size={17} /></button>
      </div>
    </form>
  )
}
