import { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft, MicOff, Crown, Volume2, VolumeX } from 'lucide-react'
import { Avatar, presenceColor } from '@/components/Avatar'
import { Skeleton } from '@/components/Skeleton'
import { presence } from '@/lib/presence'
import { voice, type VoiceParticipant } from '@/lib/voice'
import { MOCK } from '@/lib/config'
import type { Member, Presence } from '@/lib/types'

const SUB: Record<string, string> = { online: 'в сети', idle: 'отошёл', dnd: 'не беспокоить', offline: 'не в сети' }

export function MembersRail({ members, loading, expanded, onToggle, voiceParticipants, voiceChannelName, meId, onOpenDm }: {
  members: Member[]
  loading?: boolean
  expanded: boolean
  onToggle: () => void
  voiceParticipants?: VoiceParticipant[]
  voiceChannelName?: string | null
  meId?: string
  onOpenDm?: (userId: string) => void
}) {
  const [, setTick] = useState(0)
  useEffect(() => presence.subscribe(() => setTick((t) => t + 1)), [])

  // живой статус: из presence-стора (дельты по WS); в mock — то, что пришло из /server/members
  const stat = (m: Member): Presence => (MOCK ? m.status : presence.statusOf(m.userId))
  const online = members.filter((m) => stat(m) !== 'offline')
  const offline = members.filter((m) => stat(m) === 'offline')

  return (
    <div style={{ width: expanded ? 230 : 66, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflow: 'hidden', transition: 'width .32s cubic-bezier(.22,.61,.36,1)' }}>
      <div style={{ height: 46, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid var(--border)', justifyContent: expanded ? undefined : 'center' }}>
        {expanded && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>УЧАСТНИКИ · {members.length}</span>}
        <button className="ib no-drag" onClick={onToggle} title={expanded ? 'Свернуть' : 'Развернуть'} style={{ marginLeft: expanded ? 'auto' : undefined, background: 'var(--surface-2)', width: 28, height: 28 }}>{expanded ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
      </div>
      <div style={{ overflow: 'auto', flex: 1, padding: '10px 9px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && members.length === 0 && [0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6 }}>
            <Skeleton w={38} h={38} r={38} style={{ flex: 'none' }} />
            {expanded && <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}><Skeleton w="60%" h={10} /><Skeleton w="40%" h={9} /></div>}
          </div>
        ))}
        {voiceChannelName && (voiceParticipants?.length ?? 0) > 0 && (
          <>
            <Group label={`${voiceChannelName} · ${voiceParticipants!.length}`} show={expanded} color="var(--green)" icon={<Volume2 size={12} />} />
            {voiceParticipants!.map((p) => <VoiceRow key={p.id} p={p} expanded={expanded} self={p.id === meId} />)}
          </>
        )}
        {online.length > 0 && <Group label={`В СЕТИ · ${online.length}`} show={expanded} />}
        {online.map((m) => <Row key={m.userId} m={m} status={stat(m)} expanded={expanded} self={m.userId === meId} onOpenDm={onOpenDm} />)}
        {offline.length > 0 && <Group label={`НЕ В СЕТИ · ${offline.length}`} show={expanded} />}
        {offline.map((m) => <Row key={m.userId} m={m} status="offline" expanded={expanded} dim self={m.userId === meId} onOpenDm={onOpenDm} />)}
      </div>
    </div>
  )
}

// Строка участника голосового: имя + индикатор мьюта + персональная громкость (для собеседников).
// Слайдер раскрывается ИНЛАЙН под строкой — поповер в скролл-контейнере рейла обрезался бы overflow:auto.
function VoiceRow({ p, expanded, self }: { p: VoiceParticipant; expanded: boolean; self: boolean }) {
  const [volOpen, setVolOpen] = useState(false)
  const pct = Math.round(p.volume * 100)
  return (
    <div>
      <div className="member-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6 }}>
        <Avatar name={p.name} size={38} ringColor={p.speaking ? '#2faa6a' : undefined} />
        {expanded && <div style={{ fontWeight: 600, fontSize: 13.5, color: p.speaking ? 'var(--green)' : 'var(--text)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>}
        {expanded && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
            {!p.micOn && <span style={{ color: 'var(--danger)', display: 'flex' }}><MicOff size={13} /></span>}
            {!self && (
              <button className="ib no-drag" title="Громкость" onClick={() => setVolOpen((v) => !v)} style={{ width: 26, height: 26, color: volOpen || p.volume !== 1 ? 'var(--accent)' : 'var(--text-3)' }}>
                {p.volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
          </span>
        )}
      </div>
      {expanded && volOpen && !self && (
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '2px 10px 9px 12px' }}>
          <input type="range" min={0} max={200} step={5} value={pct} onChange={(e) => voice.setParticipantVolume(p.id, Number(e.target.value) / 100)} style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', width: 36, textAlign: 'right' }}>{pct}%</span>
        </div>
      )}
    </div>
  )
}

function Group({ label, show, color, icon }: { label: string; show: boolean; color?: string; icon?: React.ReactNode }) {
  if (!show) return null
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: color || 'var(--text-3)', padding: '11px 8px 7px', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</div>
}

function Row({ m, status, expanded, dim, self, onOpenDm }: { m: Member; status: Presence; expanded: boolean; dim?: boolean; self?: boolean; onOpenDm?: (userId: string) => void }) {
  return (
    <div className="member-row" onClick={() => { if (!self) onOpenDm?.(m.userId) }} title={self ? undefined : 'Личные сообщения'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, cursor: self ? 'default' : 'pointer' }}>
      <Avatar name={m.username} src={m.avatarUrl} size={38} presence={status} dim={dim} />
      {expanded && (
        <>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.username}</div>
            <div style={{ fontSize: 11, color: presenceColor(status) }}>{SUB[status]}</div>
          </div>
          {m.role === 'OWNER' && <span style={{ marginLeft: 'auto', color: 'var(--accent)', display: 'flex' }}><Crown size={13} /></span>}
          {m.role === 'ADMIN' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>admin</span>}
        </>
      )}
    </div>
  )
}
