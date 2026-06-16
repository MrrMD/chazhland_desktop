import { Message } from './Message'
import type { Message as Msg, ReadState } from '@/lib/types'

export function ChatFeed({ messages, readState, onReact }: { messages: Msg[]; readState?: ReadState; onReact?: (messageId: string, emoji: string) => void }) {
  // индекс первого непрочитанного (после lastReadMessageId)
  let firstUnread = -1
  if (readState?.lastReadMessageId) {
    const idx = messages.findIndex((m) => m.id === readState.lastReadMessageId)
    if (idx >= 0 && idx < messages.length - 1) firstUnread = idx + 1
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 26px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Divider label="Сегодня" />
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}>
          В канале пока нет сообщений — напишите первым.
        </div>
      )}
      {messages.map((m, i) => (
        <div key={m.id}>
          {i === firstUnread && <UnreadDivider />}
          <Message m={m} onReact={(emoji) => onReact?.(m.id, emoji)} />
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-3)', animation: `blink 1.3s ${i * 0.2}s infinite` }} />
            ))}
          </span>
        </div>
        <span><b style={{ color: 'var(--text-2)' }}>Лена</b> печатает…</span>
      </div>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 14px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

function UnreadDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--accent)' }} />
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--accent)' }}>НОВЫЕ СООБЩЕНИЯ</span>
      <div style={{ flex: 1, height: 1, background: 'var(--accent)' }} />
    </div>
  )
}
