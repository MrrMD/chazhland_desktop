import { useEffect, useRef, useState } from 'react'
import { Camera, Lock, LogOut } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Avatar } from '@/components/Avatar'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/theme/ThemeProvider'
import { ACCENTS, type ThemeName } from '@/theme/themes'
import { notifyPrefs } from '@/lib/prefs'
import { nameStyle, profileBgLayer, SLOT_LABELS, SLOT_ORDER } from '@/lib/cosmetics'
import type { MyRank, RankCatalog, RankCosmetic } from '@/lib/types'

const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }
const fieldS: React.CSSProperties = { padding: '11px 13px', marginBottom: 13 }

export function SettingsModal({ onClose, onEquipChange, onProfileBgChange }: { onClose: () => void; onEquipChange?: (equipped: Record<string, string>) => void; onProfileBgChange?: (url: string | null) => void }) {
  const { session, updateUser, logout } = useAuth()
  const user = session!.user
  const { theme, accent, setTheme, setAccent } = useTheme()
  const [np, setNp] = useState(notifyPrefs.get())
  function updNp(p: Partial<typeof np>) { notifyPrefs.set(p); setNp(notifyPrefs.get()) }
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

      <SectionTitle>Внешний вид</SectionTitle>
      <label style={lbl}>Тема</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['light', 'dark'] as ThemeName[]).map((t) => (
          <button key={t} type="button" onClick={() => setTheme(t)} className="no-drag" style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: `1.5px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`, background: theme === t ? 'var(--accent-tint)' : 'var(--surface)', color: theme === t ? 'var(--accent)' : 'var(--text)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{t === 'light' ? 'Светлая' : 'Тёмная'}</button>
        ))}
      </div>
      <label style={lbl}>Акцент</label>
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        {ACCENTS.map((c) => {
          const sel = accent.toLowerCase() === c.toLowerCase()
          return <button key={c} type="button" onClick={() => setAccent(c)} aria-label={`акцент ${c}`} className="no-drag" style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: sel ? '2px solid var(--text)' : '1px solid var(--border-2)', outlineOffset: 2 }} />
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

      <SectionTitle>Награды · косметика</SectionTitle>
      <CosmeticsSection meName={username.trim() || user.username} meAvatar={user.avatarUrl} onEquipChange={onEquipChange} onProfileBgChange={onProfileBgChange} />

      <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />

      <SectionTitle>Уведомления</SectionTitle>
      <ToggleRow label="Десктоп-уведомления" hint="всплывающие окна о сообщениях" on={np.desktop} onChange={(v) => updNp({ desktop: v })} />
      <ToggleRow label="Звуки уведомлений" hint="пинг при упоминании, ЛС и реакции" on={np.sounds} onChange={(v) => updNp({ sounds: v })} />
      <ToggleRow label="Тихо в режиме «Не беспокоить»" hint="без всплывашек и звука при статусе dnd" on={np.respectDnd} onChange={(v) => updNp({ respectDnd: v })} />

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

function CosmeticsSection({ meName, meAvatar, onEquipChange, onProfileBgChange }: { meName: string; meAvatar: string | null; onEquipChange?: (equipped: Record<string, string>) => void; onProfileBgChange?: (url: string | null) => void }) {
  const [catalog, setCatalog] = useState<RankCatalog | null>(null)
  const [mine, setMine] = useState<MyRank | null>(null)
  const [equipped, setEquipped] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null) // cosmeticId/slot в процессе
  const [bgUrl, setBgUrl] = useState<string | null>(null) // загруженный фон профиля
  const [bgBusy, setBgBusy] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    Promise.all([api.rankCatalog(), api.myRank()])
      .then(([c, m]) => { if (!alive) return; setCatalog(c); setMine(m); setEquipped({ ...(m.equipped ?? {}) }); setBgUrl(m.profileBackgroundUrl ?? null) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  async function pickBg(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Фон должен быть изображением'); return }
    setBgBusy(true)
    try {
      const up = await api.uploadFile(file)
      const url = await api.setProfileBackground(up.objectKey)
      setBgUrl(url); onProfileBgChange?.(url)
      toast.ok('Фон профиля обновлён')
    } catch { toast.error('Не удалось загрузить фон') }
    finally { setBgBusy(false) }
  }
  async function removeBg() {
    setBgBusy(true)
    try { await api.clearProfileBackground(); setBgUrl(null); onProfileBgChange?.(null); toast.ok('Фон профиля снят') }
    catch { toast.error('Не удалось снять фон') }
    finally { setBgBusy(false) }
  }

  async function equip(slot: string, cosmeticId: string | null) {
    const key = cosmeticId ?? `none:${slot}`
    const prev = equipped // состояние ИМЕННО перед этим вызовом (не снимок монтирования)
    setBusy(key)
    const next = { ...equipped }
    if (cosmeticId) next[slot] = cosmeticId; else delete next[slot]
    setEquipped(next) // оптимистично
    try {
      const saved = await api.equipCosmetic(slot, cosmeticId)
      setEquipped(saved)
      onEquipChange?.(saved)
    } catch {
      setEquipped(prev) // откат только этого изменения — прежние удачные экипировки сохраняются
      onEquipChange?.(prev) // держим родителя (рейл/чат/мини-профиль) в синхроне с откатом
      toast.error('Не удалось применить')
    } finally { setBusy(null) }
  }

  if (!catalog || !mine) {
    return <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface-2)', animation: 'live 1.4s ease-in-out infinite' }} />)}</div>
  }

  const unlocked = new Set(mine.unlockedCosmeticIds)
  const slots = SLOT_ORDER.filter((s) => catalog.cosmetics.some((c) => c.slot === s))
  const unlockedCount = catalog.cosmetics.filter((c) => unlocked.has(c.id)).length
  // загружаемые (userUpload) косметики фона профиля: открыта ли хоть одна (иначе — на каком уровне откроется)
  const uploadCosmetics = catalog.cosmetics.filter((c) => c.slot === 'profileBg' && c.kind === 'userUpload')
  const canUploadBg = uploadCosmetics.some((c) => unlocked.has(c.id))
  const uploadAtLevel = uploadCosmetics.length ? Math.min(...uploadCosmetics.map((c) => c.unlockLevel)) : null
  const bgStyle = bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : (profileBgLayer(equipped.profileBg) ?? null)
  const hasBg = !!bgStyle

  return (
    <div>
      {/* живое превью-карточка: фон профиля + аватар с рамкой/свечением + ник с эффектом + пик-титул */}
      <div style={{ position: 'relative', overflow: 'hidden', marginBottom: 14, borderRadius: 14, border: '1px solid var(--border)' }}>
        {hasBg && <div style={{ position: 'absolute', inset: 0, ...bgStyle }} />}
        {hasBg && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,.6), rgba(0,0,0,.28))' }} />}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', background: hasBg ? 'transparent' : 'var(--surface-2)' }}>
          <Avatar name={meName} src={meAvatar} size={56} frame={equipped.frame} glow={equipped.glow} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2, ...(nameStyle(equipped.nameEffect) ?? { color: hasBg ? '#fff' : 'var(--text)' }) }}>{meName}</div>
            <div style={{ fontSize: 12, color: hasBg ? 'rgba(255,255,255,.85)' : 'var(--text-3)', marginTop: 3 }}>пик: ур.{mine.peakLevel}{mine.peakTitle ? ` · ${mine.peakTitle}` : ''} · открыто {unlockedCount} из {catalog.cosmetics.length}</div>
          </div>
        </div>
      </div>

      {/* загрузка своей картинки на фон профиля (верхняя косметика) */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Свой фон профиля</div>
        {canUploadBg ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <button type="button" className="pill no-drag" disabled={bgBusy} onClick={() => bgFileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, opacity: bgBusy ? 0.6 : 1 }}><Camera size={15} /> {bgBusy ? 'Загрузка…' : (bgUrl ? 'Заменить картинку' : 'Загрузить картинку')}</button>
            {bgUrl && <button type="button" className="no-drag" disabled={bgBusy} onClick={removeBg} style={{ fontSize: 12.5, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Снять</button>}
            <input ref={bgFileRef} type="file" accept="image/*" hidden onChange={(e) => { pickBg(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={12} /> Откроется на ур.{uploadAtLevel ?? '—'} — своя картинка/анимация на фон профиля</div>
        )}
      </div>

      {slots.map((slot) => {
        const items = catalog.cosmetics.filter((c) => c.slot === slot).sort((a, b) => a.unlockLevel - b.unlockLevel)
        return (
          <div key={slot} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>{SLOT_LABELS[slot] ?? slot}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <NoneCard active={!equipped[slot]} busy={busy === `none:${slot}`} onClick={() => equip(slot, null)} />
              {items.map((c) => (
                <CosmeticCard key={c.id} c={c} meName={meName} meAvatar={meAvatar}
                  locked={!unlocked.has(c.id)} active={equipped[slot] === c.id} busy={busy === c.id}
                  onClick={() => unlocked.has(c.id) && equip(slot, c.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const CARD = 72
function cardShell(active: boolean, locked?: boolean): React.CSSProperties {
  return {
    width: CARD, flex: 'none', borderRadius: 13, padding: 7, cursor: locked ? 'not-allowed' : 'pointer', position: 'relative',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-tint)' : 'var(--surface)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: locked ? 0.5 : 1, transition: 'border-color .15s, background .15s',
  }
}

function NoneCard({ active, busy, onClick }: { active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="no-drag" onClick={onClick} disabled={busy} style={{ ...cardShell(active), justifyContent: 'center' }} title="Снять">
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px dashed var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 18 }}>∅</div>
      <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 600 }}>без</span>
    </button>
  )
}

function CosmeticCard({ c, meName, meAvatar, locked, active, busy, onClick }: { c: RankCosmetic; meName: string; meAvatar: string | null; locked: boolean; active: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button type="button" className="no-drag" onClick={onClick} disabled={locked || busy} style={cardShell(active, locked)} title={c.name + (locked ? ` · откроется на ур.${c.unlockLevel}` : '')}>
      <CosmeticSwatch c={c} meName={meName} meAvatar={meAvatar} />
      <span style={{ fontSize: 10, color: active ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600, lineHeight: 1.15, textAlign: 'center', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name.replace(/^[^—]*— /, '')}</span>
      {locked && <span style={{ position: 'absolute', top: 5, right: 5, display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-3)', borderRadius: 6, padding: '1px 4px' }}><Lock size={9} />{c.unlockLevel}</span>}
    </button>
  )
}

/** Мини-витрина одной косметики: рамка/свечение — на аватаре, эффект ника — текстом, прочее — плашкой. */
function CosmeticSwatch({ c, meName, meAvatar }: { c: RankCosmetic; meName: string; meAvatar: string | null }) {
  if (c.slot === 'frame') return <Avatar name={meName} src={meAvatar} size={40} frame={c.id} />
  if (c.slot === 'glow') return <Avatar name={meName} src={meAvatar} size={40} glow={c.id} />
  if (c.slot === 'nameEffect') return <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, ...(nameStyle(c.id) ?? { color: 'var(--text)' }) }}>Аб</div>
  if (c.slot === 'profileBg') return <div style={{ width: 40, height: 40, borderRadius: 9, overflow: 'hidden', ...(profileBgLayer(c.id) ?? { background: 'linear-gradient(135deg,#3a3550,#5b6cff)' }) }} />
  // banner/прочее — обобщённая градиентная плашка
  return <div style={{ width: 40, height: 40, borderRadius: 9, background: 'linear-gradient(135deg,var(--accent),#13b886)', opacity: 0.85 }} />
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 12 }}>{children}</div>
}

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{hint}</div>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="no-drag" style={{ flex: 'none', width: 42, height: 24, borderRadius: 20, border: 'none', cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--surface-3)', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
      </button>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: 20, height: 20, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
}
