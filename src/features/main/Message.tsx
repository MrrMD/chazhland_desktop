import { Fragment, useState } from 'react'
import { Avatar } from '@/components/Avatar'
import type { Message as Msg } from '@/lib/types'

function hhmm(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const MENTION_RE = /(@everyone|@here|@[\p{L}\p{N}_]{2,32})/gu // \p{L} — и кириллические ники тоже
const IS_MENTION = /^(?:@everyone|@here|@[\p{L}\p{N}_]{2,32})$/u // без /g — .test() без stateful lastIndex

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
// упоминание текущего пользователя: @everyone/@here или @<его ник> как отдельный токен
function isMentioningMe(content: string, meName?: string): boolean {
  if (/@everyone|@here/u.test(content)) return true
  if (!meName) return false
  return new RegExp(`@${escapeRegExp(meName)}(?![\\p{L}\\p{N}_])`, 'u').test(content)
}

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

interface Props {
  m: Msg
  meId?: string
  meName?: string
  canModerate?: boolean
  onReact?: (emoji: string) => void
  onReply?: (m: Msg) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
}

export function Message({ m, meId, meName, canModerate, onReact, onReply, onEdit, onDelete }: Props) {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  const mention = !!m.content && isMentioningMe(m.content, meName)
  const isOwn = !!meId && m.authorId === meId
  const canDelete = isOwn || !!canModerate

  if (m.deleted) {
    return (
      <div style={{ display: 'flex', gap: 13, padding: '7px 8px', alignItems: 'center', color: 'var(--text-3)', fontStyle: 'italic', fontSize: 13 }}>
        <span style={{ width: 42, textAlign: 'center' }}>⊘</span>Сообщение удалено
      </div>
    )
  }

  function startEdit() { setVal(m.content ?? ''); setEditing(true) }
  function saveEdit() {
    const v = val.trim()
    setEditing(false)
    if (v && v !== m.content) onEdit?.(m.id, v)
  }

  return (
    <div
      className={mention ? undefined : 'msg-row'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 13, padding: mention ? '9px 8px' : '7px 8px', borderRadius: 12, position: 'relative', background: mention ? 'var(--accent-tint)' : undefined }}
    >
      {mention && <div style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: 'var(--accent)' }} />}

      {hover && !editing && (
        <div style={{ position: 'absolute', top: -12, right: 10, display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, boxShadow: '0 6px 18px -8px var(--shadow)', zIndex: 2 }}>
          <ToolBtn title="Ответить" onClick={() => onReply?.(m)}>↩</ToolBtn>
          <ToolBtn title="Реакция" onClick={() => onReact?.('👍')}>＋</ToolBtn>
          {isOwn && <ToolBtn title="Изменить" onClick={startEdit}>✎</ToolBtn>}
          {canDelete && <ToolBtn title="Удалить" danger onClick={() => onDelete?.(m.id)}>🗑</ToolBtn>}
        </div>
      )}

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

        {editing ? (
          <div>
            <textarea
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                else if (e.key === 'Escape') setEditing(false)
              }}
              style={{ width: '100%', minHeight: 40, resize: 'vertical', border: '1px solid var(--accent)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14.5, padding: '9px 12px', outline: 'none' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
              Enter — сохранить · <span onClick={() => setEditing(false)} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Esc — отмена</span>
            </div>
          </div>
        ) : (
          m.content && (
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text)' }}>
              {renderContent(m.content)}
              {m.editedAt && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>(изменено)</span>}
            </div>
          )
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

function ToolBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className="ib no-drag" onClick={onClick} title={title} style={{ width: 28, height: 26, fontSize: 14, color: danger ? 'var(--danger)' : undefined }}>{children}</button>
  )
}
