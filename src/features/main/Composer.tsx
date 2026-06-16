import { useState } from 'react'

export function Composer({ channelName, onSend }: { channelName: string; onSend: (text: string) => void }) {
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
      <div className="field" style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', padding: '11px 14px 11px 16px', gap: 12 }}>
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--surface-2)', fontSize: 18 }} title="Вложение">＋</button>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Написать в #${channelName}…`} style={{ fontSize: 14.5 }} />
        <button type="button" className="ib no-drag" style={{ width: 32, height: 32, fontSize: 18 }} title="Эмодзи">😊</button>
        <button type="submit" className="accent-btn" style={{ width: 40, height: 40, borderRadius: 12, fontSize: 17, boxShadow: '0 4px 12px var(--accent-tint)' }} title="Отправить">➤</button>
      </div>
    </form>
  )
}
