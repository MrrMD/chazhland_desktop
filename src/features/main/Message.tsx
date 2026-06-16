import { Fragment } from 'react'
import { Avatar } from '@/components/Avatar'
import type { Message as Msg } from '@/lib/types'

function hhmm(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const MENTION_RE = /(@everyone|@here|@[A-Za-z0-9_]{3,32})/g
const IS_MENTION = /^(?:@everyone|@here|@[A-Za-z0-9_]{3,32})$/ // без /g — .test() без stateful lastIndex

function renderContent(text: string) {
  const parts = text.split(MENTION_RE)
  return parts.map((p, i) =>
    IS_MENTION.test(p) ? (
      <span key={i} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>{p}</span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}

const roleBadge: Record<string, React.CSSProperties> = {
  OWNER: { background: 'var(--accent-tint)', color: 'var(--accent)' },
  ADMIN: { background: 'var(--surface-3)', color: 'var(--text-2)' },
}

export function Message({ m, onReact }: { m: Msg; onReact?: (emoji: string) => void }) {
  const mention = !!m.content && /(@everyone|@here|@я_дизайнер)/.test(m.content)

  if (m.deleted) {
    return (
      <div style={{ display: 'flex', gap: 13, padding: '7px 8px', alignItems: 'center', color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>
        <span style={{ width: 42, textAlign: 'center' }}>⊘</span>Сообщение удалено
      </div>
    )
  }

  return (
    <div
      className={mention ? undefined : 'msg-row'}
      style={{
        display: 'flex', gap: 13, padding: mention ? '9px 8px' : '7px 8px', borderRadius: 12, position: 'relative',
        background: mention ? 'var(--accent-tint)' : undefined,
      }}
    >
      {mention && <div style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: 'var(--accent)' }} />}
      <Avatar name={m.authorName} size={42} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{m.authorName}</span>
          {m.authorRole && roleBadge[m.authorRole] && (
            <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '1px 7px', ...roleBadge[m.authorRole] }}>{m.authorRole}</span>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{hhmm(m.createdAt)}</span>
        </div>
        {m.replyPreview && (
          <div style={{ borderLeft: '2px solid var(--border-2)', paddingLeft: 10, marginBottom: 5, fontSize: 12.5, color: 'var(--text-3)' }}>
            ↳ {m.replyPreview.authorName}: {m.replyPreview.content}
          </div>
        )}
        {m.content && (
          <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text)' }}>
            {renderContent(m.content)}
            {m.editedAt && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>(изменено)</span>}
          </div>
        )}
        {m.attachments.map((a, i) => (
          <div key={i} style={{ marginTop: 9, width: 330, maxWidth: '100%', height: 184, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', background: 'linear-gradient(135deg,#fbe3ee,#e7ecff)' }}>
            <button className="ib no-drag" style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, background: 'rgba(0,0,0,.5)', color: '#fff' }} title="Скачать">⤓</button>
            <div style={{ position: 'absolute', left: 14, bottom: 12, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, fontWeight: 600, borderRadius: 7, padding: '3px 9px' }}>
              {a.width && a.height ? `${a.width} × ${a.height}` : a.contentType}
            </div>
          </div>
        ))}
        {m.reactions.length > 0 && (
          <div style={{ marginTop: 9, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {m.reactions.map((r) => (
              <div key={r.emoji} onClick={() => onReact?.(r.emoji)} className={'reaction' + (r.mine ? ' mine' : '')} style={{ padding: '3px 11px', fontSize: 13, fontWeight: 600, color: r.mine ? undefined : 'var(--text-2)' }}>{r.emoji} {r.count}</div>
            ))}
            <div className="reaction" onClick={() => onReact?.('👍')} style={{ justifyContent: 'center', width: 30, height: 26, color: 'var(--text-3)' }} title="Добавить реакцию">＋</div>
          </div>
        )}
      </div>
    </div>
  )
}
