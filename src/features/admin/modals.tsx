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
