import { Plus } from 'lucide-react'
import type { ServerSummary } from '@/lib/types'

// Самая левая колонка — серверы (как «гилд-бар» в Discord). Клик переключает сервер; «+» — создать/войти.
export function GuildRail({ servers, currentId, badges, onSwitch, onAdd }: {
  servers: ServerSummary[]
  currentId: string
  badges?: Map<string, { unread: boolean; mentions: number }>
  onSwitch: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div style={{ width: 72, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0', background: 'var(--surface-2)', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
      {servers.map((s) => (
        <GuildIcon key={s.id} server={s} active={s.id === currentId} badge={badges?.get(s.id)} onClick={() => onSwitch(s.id)} />
      ))}
      <button
        className="no-drag"
        onClick={onAdd}
        title="Добавить сервер"
        style={{ width: 48, height: 48, flex: 'none', borderRadius: 16, border: '1px dashed var(--border)', background: 'var(--surface)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <Plus size={22} />
      </button>
    </div>
  )
}

function GuildIcon({ server, active, badge, onClick }: { server: ServerSummary; active: boolean; badge?: { unread: boolean; mentions: number }; onClick: () => void }) {
  const initials = server.name.replace(/\s+/g, ' ').trim().slice(0, 2).toUpperCase() || '·'
  const mentions = badge?.mentions ?? 0
  const showDot = !active && !!badge?.unread && mentions === 0 // непрочитанное без упоминаний — белая пилюля слева
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showDot && <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 4, height: 18, borderRadius: 4, background: 'var(--text)' }} />}
      <button
        className="no-drag"
        onClick={onClick}
        title={server.name}
        style={{
          width: 48, height: 48, flex: 'none', cursor: 'pointer',
          borderRadius: active ? 15 : 24, transition: 'border-radius .18s ease',
          border: 'none', overflow: 'hidden',
          background: active ? 'var(--accent)' : 'var(--surface)',
          color: active ? '#fff' : 'var(--text)',
          boxShadow: active ? '0 0 0 2px var(--accent-tint)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
        }}
      >
        {server.iconUrl
          ? <img src={server.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </button>
      {mentions > 0 && (
        <span style={{ position: 'absolute', right: -2, bottom: -2, background: 'var(--accent)', color: '#fff', borderRadius: 30, fontSize: 10, fontWeight: 700, lineHeight: '16px', minWidth: 17, height: 17, padding: '0 4px', textAlign: 'center', border: '2px solid var(--surface-2)' }}>{mentions > 99 ? '99+' : mentions}</span>
      )}
    </div>
  )
}
