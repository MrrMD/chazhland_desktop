import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import { Message } from './Message'
import { Skeleton } from '@/components/Skeleton'
import type { Message as Msg, ReadState } from '@/lib/types'

const GROUP_GAP_MS = 5 * 60 * 1000 // серия одного автора рвётся после 5 минут паузы

function dayKey(iso: string) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, now)) return 'Сегодня'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (same(d, y)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function ChatFeed({ messages, readState, onReact, meId, meName, canModerate, onReply, onEdit, onDelete, onPin, onLoadOlder, hasMore, loadingOlder, loading }: {
  messages: Msg[]
  readState?: ReadState
  onReact?: (messageId: string, emoji: string) => void
  meId?: string
  meName?: string
  canModerate?: boolean
  onReply?: (m: Msg) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (id: string) => void
  onPin?: (id: string, pinned: boolean) => void
  onLoadOlder?: () => void
  hasMore?: boolean
  loadingOlder?: boolean
  loading?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<{ h: number; t: number } | null>(null)
  const lastId = messages[messages.length - 1]?.id
  // авто-низ только при новом последнем сообщении/смене канала (не при подгрузке старых сверху)
  useEffect(() => {
    if (anchorRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId])
  // при добавлении старых сообщений сверху — сохраняем видимую позицию
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && anchorRef.current) {
      el.scrollTop = el.scrollHeight - anchorRef.current.h + anchorRef.current.t
      anchorRef.current = null
    }
  }, [messages])
  function onScroll() {
    const el = scrollRef.current
    if (!el || !hasMore || loadingOlder) return
    if (el.scrollTop < 80) { anchorRef.current = { h: el.scrollHeight, t: el.scrollTop }; onLoadOlder?.() }
  }

  // индекс первого непрочитанного (после lastReadMessageId)
  let firstUnread = -1
  if (readState?.lastReadMessageId) {
    const idx = messages.findIndex((m) => m.id === readState.lastReadMessageId)
    if (idx >= 0 && idx < messages.length - 1) firstUnread = idx + 1
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflow: 'auto', padding: '20px 26px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {loading && messages.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
          {[60, 80, 45, 70, 55].map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 13, padding: '4px 0' }}>
              <Skeleton w={42} h={42} r={42} style={{ flex: 'none' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Skeleton w={120} h={11} />
                <Skeleton w={`${w}%`} h={13} />
              </div>
            </div>
          ))}
        </div>
      )}
      {loadingOlder && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: '6px 0' }}>Загрузка…</div>}
      {!hasMore && !loading && messages.length > 0 && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 11.5, padding: '8px 0 6px' }}>Начало канала</div>}
      {!loading && messages.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '40px 0' }}>
          В канале пока нет сообщений — напишите первым.
        </div>
      )}
      {messages.map((m, i) => {
        const prev = messages[i - 1]
        const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)
        const isUnread = i === firstUnread
        const grouped = !newDay && !isUnread && !!prev && prev.authorId === m.authorId && !prev.deleted && !m.deleted &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS
        return (
          <Fragment key={m.id}>
            {newDay && <Divider label={dayLabel(m.createdAt)} />}
            {isUnread && <UnreadDivider />}
            <Message m={m} grouped={grouped} meId={meId} meName={meName} canModerate={canModerate} onReact={(emoji) => onReact?.(m.id, emoji)} onReply={onReply} onEdit={onEdit} onDelete={onDelete} onPin={onPin} />
          </Fragment>
        )
      })}
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
