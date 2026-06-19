import { Fragment, useEffect, useState } from 'react'
import { ChevronLeft, ChevronDown, Lock, Key, X, UserMinus, ArrowLeftRight, Plus, Volume2, Music, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Avatar, presenceColor } from '@/components/Avatar'
import { Skeleton } from '@/components/Skeleton'
import { ConfirmModal, ChangeRoleModal } from './modals'
import { RolesTab } from './RolesTab'
import { ChannelAccessTab } from './ChannelAccessTab'
import type { AuditEntry, Member } from '@/lib/types'

type Tab = 'members' | 'roles' | 'channels' | 'audit'
const TAB_LABEL: Record<Tab, string> = { members: 'Участники', roles: 'Роли', channels: 'Каналы', audit: 'Аудит' }

export function AdminScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('members')
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
        <button className="ib no-drag" onClick={onClose} title="Назад" style={{ width: 34, height: 30 }}><ChevronLeft size={18} /></button>
        <span style={{ fontWeight: 800, fontSize: 17 }}>Админка</span>
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: 3 }}>
          {(['members', 'roles', 'channels', 'audit'] as Tab[]).map((t) => (
            <button key={t} className={'seg-btn no-drag' + (tab === t ? ' on' : '')} onClick={() => setTab(t)} style={{ fontSize: 13, padding: '6px 13px' }}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '26px 30px' }}>
        {tab === 'members' && <MembersTab />}
        {tab === 'roles' && <RolesTab />}
        {tab === 'channels' && <ChannelAccessTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  )
}

const STATUS_TXT: Record<string, string> = { online: '● онлайн', idle: '● отошёл', dnd: '● не беспокоить', offline: '○ оффлайн' }

function MembersTab() {
  const [rows, setRows] = useState<Member[] | null>(null)
  const [kickT, setKickT] = useState<Member | null>(null)
  const [roleT, setRoleT] = useState<Member | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { let a = true; api.members().then((r) => { if (a) setRows(r) }); return () => { a = false } }, [])
  async function toggleSb(m: Member) {
    const dis = !m.soundboardDisabled
    setRows((rs) => (rs ? rs.map((x) => (x.userId === m.userId ? { ...x, soundboardDisabled: dis } : x)) : rs))
    try { await api.setMemberSoundboard(m.userId, dis); toast.ok(dis ? 'Саундпад выключен участнику' : 'Саундпад включён') }
    catch {
      toast.error('Не удалось изменить доступ к саундпаду')
      setRows((rs) => (rs ? rs.map((x) => (x.userId === m.userId ? { ...x, soundboardDisabled: !dis } : x)) : rs))
    }
  }
  if (!rows) return <Loading />
  const cols = '1.7fr 1.1fr .9fr 1fr auto'
  return (
    <div style={{ animation: 'fadeIn .35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>Участники</div>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} человек</span>
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-3)' }}>
          <span>УЧАСТНИК</span><span>РОЛЬ</span><span>СТАТУС</span><span>НА СЕРВЕРЕ С</span><span>ДЕЙСТВИЯ</span>
        </div>
        {rows.map((m) => {
          const isOwner = m.role === 'OWNER'
          return (
            <div key={m.userId} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 20px', borderBottom: '1px solid var(--surface-2)', alignItems: 'center', opacity: m.status === 'offline' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar name={m.username} src={m.avatarUrl} size={36} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.username}</span>
                {m.inVoice && <span style={{ color: 'var(--green)', display: 'flex' }}><Volume2 size={13} /></span>}
              </div>
              {isOwner
                ? <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-tint)', color: 'var(--accent)', borderRadius: 6, padding: '3px 9px', width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}>OWNER <Lock size={10} /></span>
                : <div onClick={() => setRoleT(m)} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-2)', borderRadius: 9, background: 'var(--win)', padding: '5px 11px', fontSize: 12, width: 'fit-content', cursor: 'pointer' }}>{m.role} <span style={{ color: 'var(--text-3)', display: 'flex' }}><ChevronDown size={13} /></span></div>}
              <span style={{ color: presenceColor(m.status), fontSize: 13 }}>{STATUS_TXT[m.status]}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{m.joinedAt}</span>
              {isOwner
                ? <span style={{ color: 'var(--border-2)', fontSize: 15 }}>——</span>
                : <div style={{ display: 'flex', gap: 7, color: 'var(--text-2)' }}>
                    <span onClick={() => toggleSb(m)} className="ib no-drag" style={{ width: 30, height: 30, color: m.soundboardDisabled ? 'var(--danger)' : 'var(--text-2)' }} title={m.soundboardDisabled ? 'Саундпад выключен — включить' : 'Выключить саундпад участнику'}><Music size={15} /></span>
                    <span className="ib no-drag" style={{ width: 30, height: 30 }} title="Сбросить пароль"><Key size={15} /></span>
                    <span onClick={() => setKickT(m)} className="ib no-drag" style={{ width: 30, height: 30, color: 'var(--danger)' }} title="Исключить"><X size={15} /></span>
                  </div>}
            </div>
          )
        })}
      </Card>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, background: 'var(--danger-tint)', border: '1px solid rgba(224,57,47,.3)', color: 'var(--danger)', borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 600, width: 'fit-content' }}>
        <AlertTriangle size={15} /> Нельзя исключить владельца — действия для owner и себя заблокированы
      </div>
      {kickT && <ConfirmModal title="Исключить участника" message={`Исключить ${kickT.username}? Все его сессии завершатся. Действие необратимо.`} confirmLabel="Исключить" danger busy={busy} error={err}
        onConfirm={async () => {
          const id = kickT.userId
          setBusy(true); setErr('')
          try { await api.kick(id); setRows((rs) => (rs ? rs.filter((x) => x.userId !== id) : rs)); setKickT(null) }
          catch { setErr('Не удалось исключить участника. Попробуйте ещё раз.') }
          finally { setBusy(false) }
        }}
        onClose={() => { setKickT(null); setErr('') }} />}
      {roleT && <ChangeRoleModal member={roleT} busy={busy} error={err}
        onSelect={async (role) => {
          const id = roleT.userId
          setBusy(true); setErr('')
          try { await api.changeRole(id, role); setRows((rs) => (rs ? rs.map((x) => (x.userId === id ? { ...x, role } : x)) : rs)); setRoleT(null) }
          catch { setErr('Не удалось изменить роль. Попробуйте ещё раз.') }
          finally { setBusy(false) }
        }}
        onClose={() => { setRoleT(null); setErr('') }} />}
    </div>
  )
}

const AUDIT_ICON: Record<string, { ch: React.ReactNode; bg: string; color: string }> = {
  'member.kick': { ch: <UserMinus size={16} />, bg: 'var(--danger-tint)', color: 'var(--danger)' },
  'member.role-change': { ch: <ArrowLeftRight size={16} />, bg: 'var(--blue-tint)', color: 'var(--blue)' },
  'invite.create': { ch: <Plus size={16} />, bg: 'var(--green-tint)', color: 'var(--green)' },
  'invite.revoke': { ch: <Lock size={16} />, bg: 'var(--surface-2)', color: 'var(--text-2)' },
}

function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>))
}

function AuditTab() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  useEffect(() => { let a = true; api.audit().then((r) => { if (a) setRows(r) }); return () => { a = false } }, [])
  if (!rows) return <Loading />
  return (
    <div style={{ animation: 'fadeIn .35s ease' }}>
      <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', marginBottom: 14 }}>Журнал аудита</div>
      <Card>
        {rows.map((a, idx) => {
          const ic = AUDIT_ICON[a.action] ?? { ch: '•', bg: 'var(--surface-2)', color: 'var(--text-2)' }
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '15px 20px', borderBottom: idx < rows.length - 1 ? '1px solid var(--surface-2)' : undefined }}>
              <div style={{ width: 36, height: 36, borderRadius: 11, background: ic.bg, color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>{ic.ch}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{renderBold(a.text)}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, fontFamily: 'ui-monospace,monospace' }}>{a.meta}</div>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{a.createdAt}</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
}

function Loading() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', animation: 'fadeIn .3s ease' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < 4 ? '1px solid var(--surface-2)' : undefined }}>
          <Skeleton w={36} h={36} r={36} style={{ flex: 'none' }} />
          <Skeleton w="22%" h={12} />
          <Skeleton w="14%" h={12} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}
