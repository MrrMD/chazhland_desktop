import { Fragment, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Avatar, presenceColor } from '@/components/Avatar'
import { ConfirmModal, ChangeRoleModal, CreateInviteModal } from './modals'
import type { AuditEntry, Invite, Member } from '@/lib/types'

type Tab = 'members' | 'invites' | 'audit'

export function AdminScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('members')
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
        <button className="ib no-drag" onClick={onClose} title="Назад" style={{ width: 34, height: 30, fontSize: 16 }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 17 }}>Админка</span>
        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: 3 }}>
          {(['members', 'invites', 'audit'] as Tab[]).map((t) => (
            <button key={t} className={'seg-btn no-drag' + (tab === t ? ' on' : '')} onClick={() => setTab(t)} style={{ fontSize: 13, padding: '6px 13px' }}>
              {t === 'members' ? 'Участники' : t === 'invites' ? 'Инвайты' : 'Аудит'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '26px 30px' }}>
        {tab === 'members' && <MembersTab />}
        {tab === 'invites' && <InvitesTab />}
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
  useEffect(() => { let a = true; api.members().then((r) => { if (a) setRows(r) }); return () => { a = false } }, [])
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
                <Avatar name={m.username} size={36} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.username}</span>
                {m.inVoice && <span style={{ fontSize: 11, color: 'var(--green)' }}>🔊</span>}
              </div>
              {isOwner
                ? <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-tint)', color: 'var(--accent)', borderRadius: 6, padding: '3px 9px', width: 'fit-content' }}>OWNER 🔒</span>
                : <div onClick={() => setRoleT(m)} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-2)', borderRadius: 9, background: 'var(--win)', padding: '5px 11px', fontSize: 12, width: 'fit-content', cursor: 'pointer' }}>{m.role} <span style={{ color: 'var(--text-3)' }}>⌄</span></div>}
              <span style={{ color: presenceColor(m.status), fontSize: 13 }}>{STATUS_TXT[m.status]}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{m.joinedAt}</span>
              {isOwner
                ? <span style={{ color: 'var(--border-2)', fontSize: 15 }}>——</span>
                : <div style={{ display: 'flex', gap: 7, color: 'var(--text-2)' }}>
                    <span className="ib no-drag" style={{ width: 30, height: 30 }} title="Сбросить пароль">🔑</span>
                    <span onClick={() => setKickT(m)} className="ib no-drag" style={{ width: 30, height: 30, color: 'var(--danger)' }} title="Исключить">✕</span>
                  </div>}
            </div>
          )
        })}
      </Card>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 9, background: 'var(--danger-tint)', border: '1px solid rgba(224,57,47,.3)', color: 'var(--danger)', borderRadius: 12, padding: '11px 14px', fontSize: 13, fontWeight: 600, width: 'fit-content' }}>
        ⚠ Нельзя исключить владельца — действия для owner и себя заблокированы
      </div>
      {kickT && <ConfirmModal title="Исключить участника" message={`Исключить ${kickT.username}? Все его сессии завершатся. Действие необратимо.`} confirmLabel="Исключить" danger onConfirm={() => { const id = kickT.userId; api.kick(id).then(() => setRows((rs) => (rs ? rs.filter((x) => x.userId !== id) : rs))).catch(() => {}); setKickT(null) }} onClose={() => setKickT(null)} />}
      {roleT && <ChangeRoleModal member={roleT} onSelect={(role) => { const id = roleT.userId; api.changeRole(id, role).then(() => setRows((rs) => (rs ? rs.map((x) => (x.userId === id ? { ...x, role } : x)) : rs))).catch(() => {}); setRoleT(null) }} onClose={() => setRoleT(null)} />}
    </div>
  )
}

function inviteStatus(i: Invite): { label: string; bg: string; color: string } {
  if (i.revoked) return { label: 'Отозван', bg: 'var(--surface-2)', color: 'var(--text-3)' }
  if (i.maxUses != null && i.uses >= i.maxUses) return { label: 'Исчерпан', bg: 'var(--surface-2)', color: 'var(--text-3)' }
  if (i.expiresAt && new Date(i.expiresAt).getTime() < Date.now()) return { label: 'Просрочен', bg: 'var(--warn-tint)', color: 'var(--warn)' }
  return { label: 'Активен', bg: 'var(--green-tint)', color: 'var(--green)' }
}

function InvitesTab() {
  const [rows, setRows] = useState<Invite[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeT, setRevokeT] = useState<Invite | null>(null)
  useEffect(() => { let a = true; api.invites().then((r) => { if (a) setRows(r) }); return () => { a = false } }, [])
  if (!rows) return <Loading />
  const cols = '1.4fr 1fr 1fr 1fr .9fr auto'
  return (
    <div style={{ animation: 'fadeIn .35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>Приглашения</div>
        <button onClick={() => setCreateOpen(true)} className="accent-btn no-drag" style={{ marginLeft: 'auto', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 13.5, boxShadow: '0 8px 20px var(--accent-tint)' }}>＋ Создать приглашение</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18 }}>Сам код виден только в момент создания</div>
      {createOpen && <CreateInviteModal onCreate={(p) => api.createInvite(p)} onClose={() => { setCreateOpen(false); api.invites().then(setRows) }} />}
      {revokeT && <ConfirmModal title="Отозвать приглашение" message="Код перестанет работать. История приглашений сохранится." confirmLabel="Отозвать" danger onConfirm={() => { const id = revokeT.id; api.revokeInvite(id).then(() => setRows((rs) => (rs ? rs.map((x) => (x.id === id ? { ...x, revoked: true } : x)) : rs))).catch(() => {}); setRevokeT(null) }} onClose={() => setRevokeT(null)} />}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-3)' }}>
          <span>СОЗДАЛ</span><span>СОЗДАНО</span><span>ИСПОЛЬЗ.</span><span>ИСТЕКАЕТ</span><span>СТАТУС</span><span></span>
        </div>
        {rows.map((i) => {
          const st = inviteStatus(i)
          const dead = st.label === 'Исчерпан' || st.label === 'Просрочен' || st.label === 'Отозван'
          return (
            <div key={i.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-2)', alignItems: 'center', fontSize: 13, opacity: dead ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar name={i.createdBy} size={30} />{i.createdBy}</div>
              <span style={{ color: 'var(--text-2)' }}>{fmtDate(i.createdAt)}</span>
              <span style={{ background: 'var(--surface-2)', borderRadius: 30, padding: '3px 11px', width: 'fit-content', fontWeight: 600 }}>{i.uses} / {i.maxUses ?? '∞'}</span>
              <span style={{ color: 'var(--text-2)' }}>{i.expiresAt ? fmtDate(i.expiresAt) : 'бессрочно'}</span>
              <span style={{ background: st.bg, color: st.color, borderRadius: 30, padding: '3px 11px', width: 'fit-content', fontWeight: 700 }}>{st.label}</span>
              {dead
                ? <span style={{ color: 'var(--border-2)' }}>—</span>
                : <button onClick={() => setRevokeT(i)} className="no-drag" style={{ border: '1px solid rgba(224,57,47,.4)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 9, padding: '6px 13px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Отозвать</button>}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

const AUDIT_ICON: Record<string, { ch: string; bg: string; color: string }> = {
  'member.kick': { ch: '⊖', bg: 'var(--danger-tint)', color: 'var(--danger)' },
  'member.role-change': { ch: '⇅', bg: 'var(--blue-tint)', color: 'var(--blue)' },
  'invite.create': { ch: '＋', bg: 'var(--green-tint)', color: 'var(--green)' },
  'invite.revoke': { ch: '🔒', bg: 'var(--surface-2)', color: 'var(--text-2)' },
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

function fmtDate(s: string): string {
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
}

function Loading() {
  return <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Загрузка…</div>
}
