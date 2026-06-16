import { Avatar, presenceColor } from '@/components/Avatar'
import type { Member } from '@/lib/types'
import type { VoiceParticipant } from '@/lib/voice'

const SUB: Record<string, string> = { online: 'в сети', idle: 'отошёл', dnd: 'не беспокоить', offline: 'не в сети' }

export function MembersRail({ members, expanded, onToggle, voiceParticipants, voiceChannelName }: {
  members: Member[]
  expanded: boolean
  onToggle: () => void
  voiceParticipants?: VoiceParticipant[]
  voiceChannelName?: string | null
}) {
  const speaking = members.filter((m) => m.inVoice && m.speaking)
  const online = members.filter((m) => m.status !== 'offline' && !(m.inVoice && m.speaking))
  const offline = members.filter((m) => m.status === 'offline')

  return (
    <div style={{ width: expanded ? 230 : 66, flex: 'none', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)', overflow: 'hidden', transition: 'width .32s cubic-bezier(.22,.61,.36,1)' }}>
      <div style={{ height: 46, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
        {expanded && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>УЧАСТНИКИ · {members.length}</span>}
        <button className="ib no-drag" onClick={onToggle} style={{ marginLeft: 'auto', background: 'var(--surface-2)', width: 28, height: 28, fontSize: 12 }}>{expanded ? '⟩' : '⟨'}</button>
      </div>
      <div style={{ overflow: 'auto', flex: 1, padding: '10px 9px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {voiceChannelName && (voiceParticipants?.length ?? 0) > 0 && (
          <>
            <Group label={`🔊 ${voiceChannelName} · ${voiceParticipants!.length}`} show={expanded} color="var(--green)" />
            {voiceParticipants!.map((p) => (
              <div key={p.id} className="member-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6 }}>
                <Avatar name={p.name} size={38} ringColor={p.speaking ? '#2faa6a' : undefined} />
                {expanded && <div style={{ fontWeight: 600, fontSize: 13.5, color: p.speaking ? 'var(--green)' : 'var(--text)', minWidth: 0 }}>{p.name}</div>}
                {expanded && !p.micOn && <span style={{ marginLeft: 'auto', color: 'var(--danger)', fontSize: 13 }}>🔇</span>}
              </div>
            ))}
          </>
        )}
        {speaking.length > 0 && <Group label="🎙 ГОВОРЯТ" show={expanded} color="var(--green)" />}
        {speaking.map((m) => <Row key={m.userId} m={m} expanded={expanded} speaking />)}
        {online.length > 0 && <Group label={`В СЕТИ · ${online.length}`} show={expanded} />}
        {online.map((m) => <Row key={m.userId} m={m} expanded={expanded} />)}
        {offline.length > 0 && <Group label={`НЕ В СЕТИ · ${offline.length}`} show={expanded} />}
        {offline.map((m) => <Row key={m.userId} m={m} expanded={expanded} dim />)}
      </div>
    </div>
  )
}

function Group({ label, show, color }: { label: string; show: boolean; color?: string }) {
  if (!show) return null
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: color || 'var(--text-3)', padding: '11px 8px 7px' }}>{label}</div>
}

function Row({ m, expanded, speaking, dim }: { m: Member; expanded: boolean; speaking?: boolean; dim?: boolean }) {
  return (
    <div className="member-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6 }}>
      <Avatar name={m.username} size={38} presence={speaking ? undefined : m.status} ringColor={speaking ? '#2faa6a' : undefined} dim={dim} />
      {expanded && (
        <>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.username}</div>
            <div style={{ fontSize: 11, color: speaking ? 'var(--green)' : presenceColor(m.status) }}>
              {speaking ? (m.inVoice ? 'говорит' : '') : SUB[m.status]}{speaking && m.role === 'OWNER' ? ' · 🖥' : ''}
            </div>
          </div>
          {m.role === 'OWNER' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>♛</span>}
          {m.role === 'ADMIN' && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>admin</span>}
        </>
      )}
    </div>
  )
}
