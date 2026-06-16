import { useState } from 'react'

export function Composer({ channelName, onSend, replyToName, onCancelReply }: {
  channelName: string
  onSend: (text: string) => void
  replyToName?: string | null
  onCancelReply?: () => void
}) {
  const [text, setText] = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }
  return (
    <form onSubmit={submit} style={{ padding: '8px 26px 18px', flex: 'none' }}>
      {replyToName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px 10px 0 0', padding: '6px 14px', marginBottom: -1 }}>
          Ответ <b style={{ fontWeight: 600, color: 'var(--text)' }}>{replyToName}</b>
          <button type="button" className="ib no-drag" onClick={onCancelReply} title="Отменить ответ" style={{ marginLeft: 'auto', width: 22, height: 20, fontSize: 12 }}>✕</button>
        </div>
      )}
      <div className="field" style={{ borderRadius: replyToName ? '0 0 16px 16px' : 16, border: '1px solid var(--border)', background: 'var(--surface)', padding: '11px 14px 11px 16px', gap: 12 }}>
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', fontSize: 18 }} title="Вложение">＋</button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Написать в #${channelName}…`} style={{ fontSize: 14.5 }} />
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32, fontSize: 18 }} title="Эмодзи">😊</button>
        <button type="submit" className="accent-btn" style={{ width: 40, height: 40, borderRadius: 12, fontSize: 17, boxShadow: '0 4px 12px var(--accent-tint)' }} title="Отправить">➤</button>
      </div>
    </form>
  )
}
