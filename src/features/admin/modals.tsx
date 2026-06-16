import { useState } from 'react'
import { Modal } from '@/components/Modal'
import type { Member, Role } from '@/lib/types'

export function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose, error, busy }: {
  title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; error?: string; busy?: boolean
}) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: error ? 14 : 20 }}>{message}</div>
      {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-tint)', border: '1px solid rgba(224,57,47,.3)', borderRadius: 10, padding: '9px 12px', marginBottom: 18 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="pill no-drag" onClick={onClose} disabled={busy} style={{ padding: '10px 16px', fontWeight: 600, opacity: busy ? 0.5 : 1 }}>Отмена</button>
        <button className={(danger ? 'danger-btn' : 'accent-btn') + ' no-drag'} onClick={onConfirm} disabled={busy} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700, opacity: busy ? 0.6 : 1 }}>{busy ? '…' : confirmLabel}</button>
      </div>
    </Modal>
  )
}

const ROLES: Role[] = ['OWNER', 'ADMIN', 'MEMBER']

export function ChangeRoleModal({ member, onSelect, onClose, error, busy }: { member: Member; onSelect: (r: Role) => void; onClose: () => void; error?: string; busy?: boolean }) {
  const [sel, setSel] = useState<Role>(member.role)
  return (
    <Modal title={`Роль · ${member.username}`} onClose={busy ? () => {} : onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setSel(r)} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', border: `1.5px solid ${sel === r ? 'var(--accent)' : 'var(--border)'}`, background: sel === r ? 'var(--accent-tint)' : 'var(--surface)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', color: sel === r ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: 14 }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', border: `2px solid ${sel === r ? 'var(--accent)' : 'var(--border-2)'}`, background: sel === r ? 'var(--accent)' : 'transparent' }} />
            {r}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Понизить последнего владельца нельзя — бэкенд отклонит запрос.</div>
      {error && <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-tint)', border: '1px solid rgba(224,57,47,.3)', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="pill no-drag" onClick={onClose} disabled={busy} style={{ padding: '10px 16px', fontWeight: 600, opacity: busy ? 0.5 : 1 }}>Отмена</button>
        <button className="accent-btn no-drag" disabled={busy || sel === member.role} onClick={() => onSelect(sel)} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700, opacity: (busy || sel === member.role) ? 0.5 : 1 }}>{busy ? '…' : 'Сохранить'}</button>
      </div>
    </Modal>
  )
}

export function CreateInviteModal({ onCreate, onClose }: {
  onCreate: (p: { maxUses: number | null; expiresAt: string | null }) => Promise<{ code: string }>
  onClose: () => void
}) {
  const [maxUses, setMaxUses] = useState('')
  const [expiry, setExpiry] = useState<'1d' | '7d' | '30d' | 'never'>('7d')
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function expiresIso(): string | null {
    if (expiry === 'never') return null
    const days = expiry === '1d' ? 1 : expiry === '7d' ? 7 : 30
    return new Date(Date.now() + days * 86400000).toISOString()
  }
  async function submit() {
    setLoading(true)
    try {
      const r = await onCreate({ maxUses: maxUses ? Number(maxUses) : null, expiresAt: expiresIso() })
      setCode(r.code)
    } catch { /* TODO toast */ } finally { setLoading(false) }
  }

  return (
    <Modal title="Создать приглашение" onClose={onClose}>
      {code ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>Код показывается один раз — скопируйте и передайте лично.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 16, fontWeight: 600, letterSpacing: '.06em' }}>
            <span style={{ flex: 1 }}>{code}</span>
            <button className="pill no-drag" onClick={() => { navigator.clipboard?.writeText(code); setCopied(true) }} style={{ padding: '7px 12px', fontWeight: 600 }}>{copied ? 'Скопировано' : 'Копировать'}</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="accent-btn no-drag" onClick={onClose} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700 }}>Готово</button>
          </div>
        </div>
      ) : (
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Лимит использований</label>
          <div className="field" style={{ padding: '11px 14px', margin: '7px 0 16px' }}>
            <input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))} placeholder="без лимита" inputMode="numeric" />
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Срок действия</label>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0 20px' }}>
            {([['1d', '1 день'], ['7d', '7 дней'], ['30d', '30 дней'], ['never', 'бессрочно']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setExpiry(v)} className="no-drag" style={{ flex: 1, border: `1.5px solid ${expiry === v ? 'var(--accent)' : 'var(--border)'}`, background: expiry === v ? 'var(--accent-tint)' : 'var(--surface)', color: expiry === v ? 'var(--accent)' : 'var(--text-2)', borderRadius: 10, padding: '9px 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="pill no-drag" onClick={onClose} style={{ padding: '10px 16px', fontWeight: 600 }}>Отмена</button>
            <button className="accent-btn no-drag" disabled={loading} onClick={submit} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700 }}>{loading ? 'Создаём…' : 'Создать'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
