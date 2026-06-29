import { useEffect, useState } from 'react'
import { X, Medal, Pin, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { useEscape } from '@/lib/useEscape'
import { Skeleton } from '@/components/Skeleton'
import { toast } from '@/lib/toast'
import type { AchievementCard, MyAchievements } from '@/lib/types'

function dt(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Боковая панель «Ачивки»: открытые (с закреплением на витрину), не-секретные к получению, счётчик скрытых.
export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<MyAchievements | null>(null)
  const [busy, setBusy] = useState(false)
  useEscape(onClose)

  const reload = () => api.myAchievements().then(setData).catch(() => setData(null))
  useEffect(() => { let alive = true; api.myAchievements().then((r) => { if (alive) setData(r) }).catch(() => { if (alive) setData(null) }); return () => { alive = false } }, [])

  async function togglePin(a: AchievementCard) {
    if (busy) return
    setBusy(true)
    // оптимистично
    setData((d) => d ? { ...d, unlocked: d.unlocked.map((x) => x.id === a.id ? { ...x, pinned: !x.pinned } : x) } : d)
    try { await api.pinAchievement(a.id, !a.pinned) }
    catch { toast.error('Не удалось'); await reload() }
    finally { setBusy(false) }
  }

  async function setMode(showAll: boolean) {
    if (busy || !data || data.showAll === showAll) return
    setBusy(true)
    setData((d) => d ? { ...d, showAll } : d)
    try { await api.setAchievementShowcaseMode(showAll) }
    catch { toast.error('Не удалось'); await reload() }
    finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100%', zIndex: 40, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-14px 0 40px -22px var(--shadow)', display: 'flex', flexDirection: 'column', animation: 'ovIn .2s ease' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
        <Medal size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Ачивки</span>
        {data && <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 600 }}>{data.unlockedCount}/{data.total}</span>}
        <button className="ib no-drag" onClick={onClose} title="Закрыть" style={{ marginLeft: 'auto', width: 30, height: 30, flex: 'none', background: 'var(--surface-2)' }}><X size={15} /></button>
      </div>

      {/* режим витрины на профиле */}
      {data && (
        <div className="no-drag" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>На профиле:</span>
          {[{ v: true, l: 'Все' }, { v: false, l: 'Закреплённые' }].map((o) => (
            <button key={o.l} onClick={() => setMode(o.v)} className="no-drag" style={{ cursor: 'pointer', borderRadius: 9, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, border: '1px solid ' + (data.showAll === o.v ? 'var(--accent)' : 'var(--border)'), background: data.showAll === o.v ? 'var(--accent-tint)' : 'var(--win)', color: data.showAll === o.v ? 'var(--accent)' : 'var(--text-2)' }}>{o.l}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!data && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={56} r={12} />)}
        {data?.unlocked.map((a) => <Row key={a.id} a={a} onPin={() => togglePin(a)} />)}
        {data && data.locked.length > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-3)', marginTop: 6 }}>Ещё не открыто</div>}
        {data?.locked.map((a) => <Row key={a.id} a={a} />)}
        {data && data.lockedSecretCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px dashed var(--border-2)', borderRadius: 12, padding: '12px 14px', color: 'var(--text-3)', fontSize: 13 }}>
            <Lock size={16} /> {data.lockedSecretCount} секретных ачивок ждут открытия — выслеживай сам 👀
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ a, onPin }: { a: AchievementCard; onPin?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', background: 'var(--win)', opacity: a.unlocked ? 1 : 0.55 }}>
      <span style={{ fontSize: 22, flex: 'none', filter: a.unlocked ? 'none' : 'grayscale(1)' }}>{a.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{a.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}{a.unlocked && a.unlockedAt ? ` · ${dt(a.unlockedAt)}` : ''}</div>
      </div>
      {a.unlocked && onPin && (
        <button className="ib no-drag" onClick={onPin} title={a.pinned ? 'Открепить с витрины' : 'Закрепить на витрину'} style={{ width: 30, height: 30, flex: 'none', background: a.pinned ? 'var(--accent-tint)' : 'var(--surface-2)', color: a.pinned ? 'var(--accent)' : 'var(--text-3)' }}><Pin size={14} /></button>
      )}
    </div>
  )
}
