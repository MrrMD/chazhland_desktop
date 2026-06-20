import { useRef, useState } from 'react'
import { Camera, LogOut } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { useAuth } from '@/store/auth'

const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }
const fieldS: React.CSSProperties = { padding: '11px 13px', marginBottom: 13 }

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { session, updateUser, logout } = useAuth()
  const user = session!.user
  const [username, setUsername] = useState(user.username)
  const [statusMsg, setStatusMsg] = useState(user.statusMessage ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const profileDirty = username.trim() !== user.username || statusMsg.trim() !== (user.statusMessage ?? '')

  async function saveProfile() {
    const u = username.trim()
    if (u.length < 2) { toast.error('Имя — минимум 2 символа'); return }
    setSavingProfile(true)
    try {
      const updated = await api.updateProfile({ username: u, statusMessage: statusMsg.trim() })
      updateUser({ username: updated.username, statusMessage: updated.statusMessage })
      toast.ok('Профиль сохранён')
    } catch { toast.error('Не удалось сохранить профиль') }
    finally { setSavingProfile(false) }
  }

  async function pickAvatar(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Аватар должен быть изображением'); return }
    setAvatarBusy(true)
    try {
      const up = await api.uploadFile(file)
      const updated = await api.setAvatar(up.objectKey)
      updateUser({ avatarUrl: updated.avatarUrl })
      toast.ok('Аватар обновлён')
    } catch { toast.error('Не удалось загрузить аватар') }
    finally { setAvatarBusy(false) }
  }

  async function savePassword() {
    if (newPw.length < 8) { toast.error('Новый пароль — минимум 8 символов'); return }
    if (newPw !== confirmPw) { toast.error('Пароли не совпадают'); return }
    setPwBusy(true)
    try {
      await api.changePassword({ currentPassword: curPw, newPassword: newPw })
      setCurPw(''); setNewPw(''); setConfirmPw('')
      toast.ok('Пароль изменён')
    } catch { toast.error('Не удалось сменить пароль — проверьте текущий') }
    finally { setPwBusy(false) }
  }

  async function doLogoutAll() {
    try { await api.logoutAll(); toast.ok('Все сессии завершены'); logout() } catch { toast.error('Не удалось завершить сессии') }
  }

  return (
    <Modal title="Настройки" onClose={onClose} width={480}>
      <SectionTitle>Профиль</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={user.username} src={user.avatarUrl} size={64} />
          {avatarBusy && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>}
        </div>
        <div>
          <button type="button" className="pill no-drag" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13 }}><Camera size={15} /> Изменить аватар</button>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>PNG, JPG или GIF (анимированный) — лучше квадрат</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      <label style={lbl}>Имя пользователя</label>
      <div className="field" style={fieldS}><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ваш ник" /></div>
      <label style={lbl}>О себе / статус</label>
      <div className="field" style={fieldS}><input value={statusMsg} onChange={(e) => setStatusMsg(e.target.value)} placeholder="например, на удалёнке" maxLength={255} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button type="button" className="accent-btn no-drag" disabled={!profileDirty || savingProfile} onClick={saveProfile} style={{ borderRadius: 11, padding: '9px 18px', fontWeight: 700, opacity: !profileDirty || savingProfile ? 0.55 : 1 }}>{savingProfile ? 'Сохранение…' : 'Сохранить'}</button>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

      <SectionTitle>Безопасность</SectionTitle>
      <label style={lbl}>Текущий пароль</label>
      <div className="field" style={fieldS}><input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} placeholder="••••••••" /></div>
      <label style={lbl}>Новый пароль</label>
      <div className="field" style={fieldS}><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="минимум 8 символов" /></div>
      <label style={lbl}>Повторите новый пароль</label>
      <div className="field" style={fieldS}><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button type="button" className="accent-btn no-drag" disabled={pwBusy || !curPw || !newPw || !confirmPw} onClick={savePassword} style={{ borderRadius: 11, padding: '9px 18px', fontWeight: 700, opacity: pwBusy || !curPw || !newPw || !confirmPw ? 0.55 : 1 }}>{pwBusy ? 'Смена…' : 'Сменить пароль'}</button>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
      <button type="button" className="danger-btn no-drag" onClick={doLogoutAll} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 13 }}><LogOut size={15} /> Выйти со всех устройств</button>
    </Modal>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 12 }}>{children}</div>
}

function Spinner() {
  return <span style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
}
