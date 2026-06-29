import { useEffect, useState } from 'react'
import { X, BarChart3 } from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import { useEscape } from '@/lib/useEscape'
import { Skeleton } from '@/components/Skeleton'
import type { DigestData, DigestFull, DigestNomination, DigestSummary, DigestUserRef } from '@/lib/types'

function dmy(iso: string, shiftDays = 0): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  if (shiftDays) d.setDate(d.getDate() + shiftDays)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
// период [start, end) → подпись start–(end−1день) (последний день недели включительно)
function periodLabel(s: DigestSummary): string {
  return `${dmy(s.periodStart)}–${dmy(s.periodEnd, -1)}`
}

// Боковая панель «Статистика»: история дайджестов сервера + богатый рендер выбранной недели.
export function StatsPanel({ serverId, onClose }: { serverId: string; onClose: () => void }) {
  const [list, setList] = useState<DigestSummary[] | null>(null)
  const [selId, setSelId] = useState<string | null>(null)
  const [full, setFull] = useState<DigestFull | null>(null)
  const [loading, setLoading] = useState(false)
  useEscape(onClose)

  useEffect(() => {
    let alive = true
    setSelId(null) // смена сервера: сбрасываем выбор, чтобы не дёргать чужой digest id
    api.digests(serverId || undefined)
      .then((r) => { if (alive) { setList(r); if (r[0]) setSelId(r[0].id) } })
      .catch(() => { if (alive) setList([]) })
    return () => { alive = false }
  }, [serverId])

  useEffect(() => {
    if (!selId) { setFull(null); return }
    let alive = true
    setLoading(true)
    api.digest(selId, serverId || undefined)
      .then((r) => { if (alive) setFull(r) })
      .catch(() => { if (alive) setFull(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [selId, serverId])

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100%', zIndex: 40, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-14px 0 40px -22px var(--shadow)', display: 'flex', flexDirection: 'column', animation: 'ovIn .2s ease' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: '1px solid var(--border)' }}>
        <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Статистика · Wrapped</span>
        <button className="ib no-drag" onClick={onClose} title="Закрыть" style={{ marginLeft: 'auto', width: 30, height: 30, flex: 'none', background: 'var(--surface-2)' }}><X size={15} /></button>
      </div>

      {/* селектор недель */}
      {list && list.length > 0 && (
        <div className="no-drag" style={{ flex: 'none', display: 'flex', gap: 7, overflowX: 'auto', padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
          {list.map((s) => (
            <button key={s.id} onClick={() => setSelId(s.id)} className="no-drag" style={{ flex: 'none', cursor: 'pointer', borderRadius: 9, padding: '6px 11px', fontSize: 12.5, fontWeight: 700, border: '1px solid ' + (s.id === selId ? 'var(--accent)' : 'var(--border)'), background: s.id === selId ? 'var(--accent-tint)' : 'var(--win)', color: s.id === selId ? 'var(--accent)' : 'var(--text-2)' }}>{periodLabel(s)}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
        {loading && <CardSkeleton />}
        {!loading && list && list.length === 0 && <Hint text="Дайджестов пока нет. Первый появится в понедельник." />}
        {!loading && full && <DigestCard data={full.data} />}
      </div>
    </div>
  )
}

function DigestCard({ data }: { data: DigestData }) {
  const t = data.totals
  const delta = t.messagesDeltaPercent
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* цифры недели */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        <Stat label="Сообщений" value={fmtNum(t.messages)} sub={delta == null ? undefined : `${delta >= 0 ? '+' : ''}${delta}%`} subUp={delta != null && delta >= 0} />
        <Stat label="Активных" value={String(t.activeUsers)} />
        <Stat label="Реакций" value={fmtNum(t.reactions)} />
        <Stat label="Минут в войсе" value={fmtNum(t.voiceMinutes)} />
        {t.newcomers > 0 && <Stat label="Новеньких" value={String(t.newcomers)} />}
        {t.movieNights > 0 && <Stat label="Киноночей" value={String(t.movieNights)} />}
      </div>

      {/* час пик */}
      {t.messages > 0 && <HourHistogram data={data} peak={t.peakHour} />}

      {/* номинации */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.chatterboxes?.[0] && <Nom icon="🏆" label="Болтун недели" nom={data.chatterboxes[0]} unit="сообщ." />}
        {data.star && <Nom icon="❤️" label="Звезда" nom={data.star} unit="реакц." />}
        {data.voiceChampion && <Nom icon="📞" label="Голосина" nom={data.voiceChampion} unit="мин" />}
        {data.nightOwl && <Nom icon="🦉" label="Сова" nom={data.nightOwl} unit="ноч. сообщ." />}
        {data.reactor && <Nom icon="🤡" label="Реактор" nom={data.reactor} unit="реакц." />}
        {data.necroposter && <Nom icon="🧟" label="Некропостер" nom={data.necroposter} unit="дн. назад" />}
        {data.loyalFriends && <Duo />}
      </div>

      {/* 😈 Доска позора — анти-награды (опциональны: бэк опускает пустые) */}
      {(data.ghost || data.regretter || data.voiceGhost) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>😈 Доска позора</div>
          {data.ghost && <Nom icon="👻" label="В пустоту" nom={data.ghost} unit="без реакций" />}
          {data.regretter && <Nom icon="🗯️" label="Удалил и пожалел" nom={data.regretter} unit="удалено" />}
          {data.voiceGhost && <Nom icon="🦗" label="Призрак" nom={data.voiceGhost} unit="мин молчал" />}
        </div>
      )}

      {/* сообщение недели */}
      {data.messageOfWeek && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--win)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>
            😂 Сообщение недели · {data.messageOfWeek.reactionCount} реакц.
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <Avatar name={data.messageOfWeek.author.username} src={data.messageOfWeek.author.avatarUrl} size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{data.messageOfWeek.author.username}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, wordBreak: 'break-word' }}>{data.messageOfWeek.excerpt || '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* топ-эмодзи */}
      {data.topEmoji && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
          <span style={{ fontSize: 24 }}>{data.topEmoji.emoji}</span> эмодзи недели · {data.topEmoji.count}
        </div>
      )}
    </div>
  )

  // вложенная: «верные друзья» (пара) — берёт data из замыкания
  function Duo() {
    const d = data.loyalFriends!
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--border)', borderRadius: 11, padding: '9px 12px' }}>
        <span style={{ fontSize: 19, flex: 'none' }}>🤝</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>Верные друзья</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Avatar name={d.first.username} src={d.first.avatarUrl} size={22} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.first.username}</span>
            <span style={{ color: 'var(--text-3)' }}>+</span>
            <Avatar name={d.second.username} src={d.second.avatarUrl} size={22} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{d.second.username}</span>
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', flex: 'none' }}>{d.minutes} мин</span>
      </div>
    )
  }
}

function Nom({ icon, label, nom, unit }: { icon: string; label: string; nom: DigestNomination; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--border)', borderRadius: 11, padding: '9px 12px' }}>
      <span style={{ fontSize: 19, flex: 'none' }}>{icon}</span>
      <Avatar name={nom.user.username} src={nom.user.avatarUrl} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom.user.username}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', flex: 'none' }}>{fmtNum(nom.value)} <span style={{ fontWeight: 500, color: 'var(--text-3)', fontSize: 11 }}>{unit}</span></span>
    </div>
  )
}

function HourHistogram({ data, peak }: { data: DigestData; peak: number | null }) {
  const max = Math.max(1, ...data.activityByHour.map((b) => b.count))
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, marginBottom: 6 }}>⏰ Час пик{peak != null ? ` · ${String(peak).padStart(2, '0')}:00` : ''}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 46 }}>
        {data.activityByHour.map((b) => (
          <div key={b.hour} title={`${String(b.hour).padStart(2, '0')}:00 — ${b.count}`} style={{ flex: 1, height: `${Math.max(3, (b.count / max) * 100)}%`, borderRadius: 2, background: b.hour === peak ? 'var(--accent)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, subUp }: { label: string; value: string; sub?: string; subUp?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px', background: 'var(--win)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{value}</span>
        {sub && <span style={{ fontSize: 12, fontWeight: 700, color: subUp ? 'var(--ok, #16a34a)' : 'var(--danger)' }}>{sub}</span>}
      </div>
    </div>
  )
}

function fmtNum(n: number): string {
  return n.toLocaleString('ru-RU')
}

function CardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={58} r={11} />)}</div>
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={48} r={11} />)}
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, padding: '34px 14px' }}>{text}</div>
}
