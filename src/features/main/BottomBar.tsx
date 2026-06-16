import { useState } from 'react'
import { LayoutGrid, Settings, Check, Mic, MicOff, Shield, LogOut, Volume2, Headphones, MonitorUp, PhoneOff, UserRound } from 'lucide-react'
import { Avatar, presenceColor } from '@/components/Avatar'
import type { Presence, User } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = { online: 'В сети', idle: 'Не активен', dnd: 'Не беспокоить', offline: 'Не в сети' }
const STATUS_OPTS: Presence[] = ['online', 'idle', 'dnd']

interface Props {
  user: User
  status: Presence
  onStatus: (s: Presence) => void
  muted: boolean
  onMute: () => void
  deafened: boolean
  onDeaf: () => void
  streamOn: boolean
  onGoLive: () => void
  voiceChannelName: string | null
  onOpenChannels: () => void
  unreadTotal: number
  onAckAll: () => void
  onOpenVoiceSettings: () => void
  onOpenSettings: () => void
  onOpenAdmin: () => void
  onLogout: () => void
  onLeaveVoice: () => void
}

export function BottomBar(p: Props) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ height: 74, flex: 'none', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 18px', gap: 12 }}>
      {/* left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifySelf: 'start', position: 'relative' }}>
        <button className="pill no-drag" onClick={p.onOpenChannels} style={{ padding: '10px 15px', fontWeight: 600, fontSize: 13.5, position: 'relative' }}>
          <LayoutGrid size={16} /> Сменить канал
          {p.unreadTotal > 0 && <span style={{ position: 'absolute', top: -7, right: -7, background: 'var(--danger)', color: '#fff', borderRadius: 30, fontSize: 10, fontWeight: 700, padding: '1px 6px', border: '2px solid var(--surface)' }}>{p.unreadTotal}</span>}
        </button>
        <button className="pill no-drag" onClick={() => setMenuOpen((v) => !v)} title="Настройки" style={{ width: 46, height: 46, justifyContent: 'center', color: 'var(--text-2)' }}><Settings size={18} /></button>
        {menuOpen && (
          <Popover onClose={() => setMenuOpen(false)} style={{ left: 0 }}>
            <MenuItem label="Прочитать всё" icon={<Check size={15} />} onClick={() => { setMenuOpen(false); p.onAckAll() }} />
            <MenuItem label="Профиль" icon={<UserRound size={15} />} onClick={() => { setMenuOpen(false); p.onOpenSettings() }} />
            <MenuItem label="Настройки голоса" icon={<Mic size={15} />} onClick={() => { setMenuOpen(false); p.onOpenVoiceSettings() }} />
            <MenuItem label="Админ-панель" icon={<Shield size={15} />} onClick={() => { setMenuOpen(false); p.onOpenAdmin() }} />
            <MenuItem label="Выйти" icon={<LogOut size={15} />} danger onClick={() => { setMenuOpen(false); p.onLogout() }} />
          </Popover>
        )}
      </div>

      {/* center profile + status switcher */}
      <div style={{ justifySelf: 'center', position: 'relative' }}>
        <button onClick={() => setStatusOpen((v) => !v)} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--win)', border: '1px solid var(--border)', borderRadius: 15, padding: '7px 18px 7px 9px', cursor: 'pointer', color: 'var(--text)' }}>
          <Avatar name={p.user.username} src={p.user.avatarUrl} size={40} presence={p.status} />
          <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.user.username}</div>
            <div style={{ fontSize: 11.5, color: presenceColor(p.status), display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: presenceColor(p.status) }} />
              {p.voiceChannelName ? `в эфире · ${p.voiceChannelName}` : STATUS_LABEL[p.status]}
            </div>
          </div>
        </button>
        {statusOpen && (
          <Popover onClose={() => setStatusOpen(false)} style={{ left: '50%', transform: 'translateX(-50%)' }}>
            {STATUS_OPTS.map((s) => (
              <MenuItem key={s} label={STATUS_LABEL[s]} dot={presenceColor(s)} onClick={() => { setStatusOpen(false); p.onStatus(s) }} active={s === p.status} />
            ))}
          </Popover>
        )}
      </div>

      {/* right voice controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifySelf: 'end' }}>
        {p.voiceChannelName ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontSize: 13, fontWeight: 600, padding: '0 6px' }}><Volume2 size={15} /> {p.voiceChannelName}</span>
            <VBtn active={p.muted} onClick={p.onMute} title={p.muted ? 'Включить микрофон' : 'Выключить микрофон'}>{p.muted ? <MicOff size={18} /> : <Mic size={18} />}</VBtn>
            <VBtn active={p.deafened} onClick={p.onDeaf} title="Наушники"><Headphones size={18} /></VBtn>
            <button onClick={p.onGoLive} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 9, border: `1px solid ${p.streamOn ? 'var(--accent)' : 'var(--border)'}`, background: p.streamOn ? 'var(--accent-tint)' : 'var(--win)', color: p.streamOn ? 'var(--accent)' : 'var(--text-2)', borderRadius: 13, padding: '0 16px', height: 46, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
              <MonitorUp size={16} /> Демонстрация
            </button>
            <button onClick={p.onLeaveVoice} className="danger-btn no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 13, padding: '0 17px', height: 46, fontWeight: 700, fontSize: 13.5, boxShadow: '0 4px 12px rgba(224,57,47,.25)' }}><PhoneOff size={16} /> Выйти</button>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>не в звонке</span>
        )}
      </div>
    </div>
  )
}

function VBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="no-drag" style={{ width: 46, height: 46, borderRadius: 13, fontSize: 18, cursor: 'pointer', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-tint)' : 'var(--win)', color: active ? 'var(--accent)' : 'var(--text-2)' }}>{children}</button>
  )
}

function Popover({ children, style, onClose }: { children: React.ReactNode; style?: React.CSSProperties; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', zIndex: 31, minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 40px -16px var(--shadow)', padding: 6, ...style }}>
        {children}
      </div>
    </>
  )
}

function MenuItem({ label, icon, dot, danger, active, onClick }: { label: string; icon?: React.ReactNode; dot?: string; danger?: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: active ? 'var(--surface-2)' : 'transparent', color: danger ? 'var(--danger)' : 'var(--text)', borderRadius: 8, padding: '9px 11px', cursor: 'pointer', fontSize: 13.5, fontWeight: 500 }}>
      {dot && <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot }} />}
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {label}
    </button>
  )
}
