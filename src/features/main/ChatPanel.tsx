import { useEffect, useState } from 'react'
import { Search, X, Pin } from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import { useEscape } from '@/lib/useEscape'
import { Skeleton } from '@/components/Skeleton'
import type { Message } from '@/lib/types'

function when(iso: string) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Боковая панель поиска и закреплённых сообщений (оверлей справа над лентой).
export function ChatPanel({ mode, channelId, channelName, pinsVersion, onClose, onUnpin, onJump }: {
  mode: 'search' | 'pins'
  channelId: string
  channelName: string
  pinsVersion: number // bump → перезагрузить список пинов
  onClose: () => void
  onUnpin: (id: string) => void
  onJump: (m: Message) => void // переход к сообщению в ленте
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Message[] | null>(null)
  const [loading, setLoading] = useState(false)
  useEscape(onClose)

  useEffect(() => {
    if (mode !== 'pins') return
    let alive = true
    setLoading(true)
    api.pins(channelId).then((r) => { if (alive) setRows(r) }).catch(() => { if (alive) setRows([]) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode, channelId, pinsVersion])

  useEffect(() => {
    if (mode !== 'search') return
    const s = q.trim()
    if (!s) { setRows(null); setLoading(false); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.searchMessages(channelId, s).then((r) => { if (alive) setRows(r) }).catch(() => { if (alive) setRows([]) }).finally(() => { if (alive) setLoading(false) })
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [mode, channelId, q])

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, maxWidth: '100%', zIndex: 40, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-14px 0 40px -22px var(--shadow)', display: 'flex', flexDirection: 'column', animation: 'ovIn .2s ease' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
        {mode === 'pins' ? <Pin size={16} style={{ color: 'var(--accent)' }} /> : <Search size={16} style={{ color: 'var(--text-3)' }} />}
        <span style={{ fontWeight: 700, fontSize: 14 }}>{mode === 'pins' ? 'Закреплённые' : 'Поиск'}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{channelName}</span>
        <button className="ib no-drag" onClick={onClose} title="Закрыть" style={{ marginLeft: 'auto', width: 30, height: 30, flex: 'none', background: 'var(--surface-2)' }}><X size={15} /></button>
      </div>

      {mode === 'search' && (
        <div style={{ padding: '12px 14px', flex: 'none' }}>
          <div className="field" style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--win)', padding: '9px 13px' }}>
            <span style={{ color: 'var(--text-3)', display: 'flex' }}><Search size={15} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Текст сообщения…" autoFocus />
            {q && <button className="ib no-drag" onClick={() => setQ('')} title="Очистить" style={{ width: 22, height: 22 }}><X size={13} /></button>}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px 14px' }}>
        {loading && (
          <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 8px' }}>
                <Skeleton w={32} h={32} r={32} style={{ flex: 'none' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}><Skeleton w="45%" h={10} /><Skeleton w="85%" h={10} /></div>
              </div>
            ))}
          </div>
        )}
        {!loading && mode === 'search' && !q.trim() && <Hint text="Введите запрос для поиска по каналу" />}
        {!loading && rows && rows.length === 0 && <Hint text={mode === 'pins' ? 'Нет закреплённых сообщений' : 'Ничего не найдено'} />}
        {!loading && rows?.map((m) => (
          <div key={m.id} className="msg-row no-drag" onClick={() => onJump(m)} title="Перейти к сообщению" style={{ display: 'flex', gap: 10, padding: '9px 8px', borderRadius: 10, cursor: 'pointer' }}>
            <Avatar name={m.authorName} size={32} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{m.authorName}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{when(m.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, wordBreak: 'break-word' }}>{m.content || (m.attachments.length ? 'вложение' : '—')}</div>
            </div>
            {mode === 'pins' && (
              <button className="ib no-drag" onClick={(e) => { e.stopPropagation(); onUnpin(m.id) }} title="Открепить" style={{ width: 28, height: 28, flex: 'none', color: 'var(--accent)' }}><Pin size={14} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, padding: '34px 14px' }}>{text}</div>
}
