import { useMemo, useState } from 'react'
import type { Channel, ChannelType, ReadState } from '@/lib/types'
import { CreateChannelModal } from './CreateChannelModal'

const TYPE_ICON: Record<string, string> = { TEXT: '#', VOICE: '🔊', WATCH: '▶' }
const VOICE_LIVE: Record<string, number> = { ch_call: 3, ch_cs: 2 }

export function ChannelSwitcher({
  channels, readStates, currentId, onPick, onClose, onCreateChannel,
}: {
  channels: Channel[]
  readStates: ReadState[]
  currentId: string
  onPick: (id: string) => void
  onClose: () => void
  onCreateChannel: (p: { name: string; type: ChannelType }) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const rs = useMemo(() => Object.fromEntries(readStates.map((r) => [r.channelId, r])), [readStates])
  const filtered = channels.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
  const byType = (t: string) => filtered.filter((c) => c.type === t)

  return (
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(20,17,14,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '54px 22px', animation: 'ovIn .2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 780, maxWidth: '100%', maxHeight: '100%', background: 'var(--win)', border: '1px solid var(--border)', borderRadius: 22, boxShadow: '0 40px 90px -20px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'mdIn .32s cubic-bezier(.22,.61,.36,1)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flex: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: 19, whiteSpace: 'nowrap' }}>Сменить канал</span>
          <div className="field" style={{ flex: 1, maxWidth: 360, margin: '0 auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '9px 14px' }}>
            <span style={{ color: 'var(--text-3)' }}>🔍</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск канала…" autoFocus />
            <span style={{ fontSize: 11, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', color: 'var(--text-3)' }}>⌘K</span>
          </div>
          <button className="ib no-drag" onClick={onClose} style={{ background: 'var(--surface-2)', width: 34, height: 34, fontSize: 15 }}>✕</button>
        </div>

        <div style={{ overflow: 'auto', padding: '20px 22px 24px' }}>
          <Section title="ТЕКСТОВЫЕ" accent>
            {byType('TEXT').map((c) => <Tile key={c.id} c={c} rs={rs[c.id]} current={c.id === currentId} onPick={onPick} />)}
          </Section>
          <Section title="ГОЛОСОВЫЕ">
            {byType('VOICE').map((c) => <Tile key={c.id} c={c} rs={rs[c.id]} current={c.id === currentId} onPick={onPick} />)}
          </Section>
          <Section title="КИНОТЕАТР" last>
            {byType('WATCH').map((c) => <Tile key={c.id} c={c} rs={rs[c.id]} current={c.id === currentId} onPick={onPick} />)}
            <div className="tile" onClick={() => setCreateOpen(true)} style={{ border: '1.5px dashed var(--border-2)', borderRadius: 16, padding: 15, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', minHeight: 96 }}>
              <div style={{ fontSize: 22 }}>＋</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 5 }}>создать канал</div>
            </div>
          </Section>
        </div>
        {createOpen && <CreateChannelModal onCreate={onCreateChannel} onClose={() => setCreateOpen(false)} />}
      </div>
    </div>
  )
}

function Section({ title, accent, last, children }: { title: string; accent?: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: accent ? 'var(--accent)' : 'var(--text-3)', padding: '0 2px 12px' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: last ? 0 : 24 }}>{children}</div>
    </>
  )
}

function Tile({ c, rs, current, onPick }: { c: Channel; rs?: ReadState; current: boolean; onPick: (id: string) => void }) {
  const live = VOICE_LIVE[c.id]
  const mentions = rs?.mentionCount ?? 0
  const sub = current ? 'открыт сейчас' : live ? `● ${live} в эфире` : mentions > 0 ? `${mentions} упоминаний` : c.type === 'TEXT' ? 'прочитано' : 'пусто'
  return (
    <div
      onClick={() => onPick(c.id)}
      className={current ? undefined : 'tile'}
      style={{
        position: 'relative', background: current ? 'var(--accent-tint)' : live ? 'rgba(47,170,106,.1)' : 'var(--surface)',
        border: current ? '1.5px solid var(--accent)' : live ? '1px solid rgba(47,170,106,.4)' : '1px solid var(--border)',
        borderRadius: 16, padding: 15, cursor: 'pointer',
      }}
    >
      {mentions > 0 && !current && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--accent)', color: '#fff', borderRadius: 30, fontSize: 10.5, fontWeight: 700, padding: '1px 7px' }}>{mentions}</div>
      )}
      <div style={{ width: 38, height: 38, borderRadius: 11, background: current ? 'var(--accent)' : live ? 'rgba(47,170,106,.18)' : 'var(--surface-3)', color: current ? '#fff' : live ? 'var(--green)' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: c.type === 'TEXT' ? 18 : 17 }}>
        {TYPE_ICON[c.type]}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 10, color: current ? 'var(--accent)' : 'var(--text)' }}>{c.name}</div>
      <div style={{ fontSize: 11.5, color: live ? 'var(--green)' : current ? 'var(--accent)' : 'var(--text-3)', fontWeight: live ? 600 : 400 }}>{sub}</div>
    </div>
  )
}
