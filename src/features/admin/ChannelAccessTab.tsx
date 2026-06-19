import { useEffect, useMemo, useState } from 'react'
import { Hash, Volume2, Play, Lock, Globe, Check, Minus, X } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { PERMISSIONS, DEFAULT_ROLE_COLOR } from '@/lib/permissions'
import type { Channel, ChannelOverwrite, ChannelType, Permission, ServerRole } from '@/lib/types'

type Tri = 'allow' | 'neutral' | 'deny'
const labelOf = (p: Permission) => PERMISSIONS.find((x) => x.key === p)?.label ?? p
const CH_ICON: Record<ChannelType, React.ReactNode> = { TEXT: <Hash size={15} />, VOICE: <Volume2 size={15} />, WATCH: <Play size={15} />, DM: <Hash size={15} /> }

// какие права уместны на канале данного типа
function permsForChannel(type: ChannelType): Permission[] {
  if (type === 'VOICE') return ['VIEW_CHANNEL', 'CONNECT']
  return ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES', 'MENTION_EVERYONE']
}

export function ChannelAccessTab() {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [roles, setRoles] = useState<ServerRole[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [ows, setOws] = useState<ChannelOverwrite[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let a = true
    Promise.all([api.serverTree(), api.roles()]).then(([t, r]) => {
      if (!a) return
      const chs = t.channels.filter((c) => c.type !== 'DM')
      setChannels(chs); setRoles(r)
      if (chs[0]) select(chs[0].id)
    }).catch(() => { if (a) setChannels([]) })
    return () => { a = false }
  }, [])

  async function select(id: string) {
    setSelId(id); setLoading(true)
    try { setOws(await api.channelPermissions(id)) } catch { setOws([]) } finally { setLoading(false) }
  }

  const sel = channels?.find((c) => c.id === selId) ?? null
  const owByTarget = useMemo(() => new Map(ows.map((o) => [o.targetId, o])), [ows])
  const everyone = roles.find((r) => r.isDefault)
  // @everyone сверху, затем остальные роли по убыванию позиции
  const targets = useMemo(() => {
    const rest = roles.filter((r) => !r.isDefault).sort((a, b) => b.position - a.position)
    return everyone ? [everyone, ...rest] : rest
  }, [roles, everyone])

  function triOf(targetId: string, p: Permission): Tri {
    const ow = owByTarget.get(targetId)
    if (!ow) return 'neutral'
    if (ow.allow.includes(p)) return 'allow'
    if (ow.deny.includes(p)) return 'deny'
    return 'neutral'
  }

  async function setTri(roleId: string, p: Permission, next: Tri) {
    if (!selId) return
    const ow = owByTarget.get(roleId)
    const allow = new Set(ow?.allow ?? []); const deny = new Set(ow?.deny ?? [])
    allow.delete(p); deny.delete(p)
    if (next === 'allow') allow.add(p); else if (next === 'deny') deny.add(p)
    const a = [...allow], d = [...deny]
    // оптимистично
    setOws((prev) => {
      const others = prev.filter((o) => o.targetId !== roleId)
      if (!a.length && !d.length) return others
      return [...others, { id: ow?.id ?? 'tmp', targetType: 'ROLE', targetId: roleId, allow: a, deny: d }]
    })
    try {
      if (!a.length && !d.length) await api.clearChannelPermission(selId, 'ROLE', roleId)
      else { const saved = await api.setChannelPermission(selId, { targetType: 'ROLE', targetId: roleId, allow: a, deny: d }); setOws((prev) => prev.map((o) => (o.targetId === roleId ? saved : o))) }
    } catch { toast.error('Не удалось сохранить доступ'); select(selId) }
  }

  const isPrivate = !!everyone && triOf(everyone.id, 'VIEW_CHANNEL') === 'deny'
  function togglePrivate() {
    if (!everyone) return
    setTri(everyone.id, 'VIEW_CHANNEL', isPrivate ? 'neutral' : 'deny')
  }

  if (!channels) return <div style={{ color: 'var(--text-3)', padding: 20 }}>Загрузка каналов…</div>

  return (
    <div style={{ display: 'flex', gap: 18, animation: 'fadeIn .35s ease', height: '100%' }}>
      {/* список каналов */}
      <div style={{ width: 240, flex: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'auto' }}>
        {channels.map((c) => (
          <button key={c.id} onClick={() => select(c.id)} className="no-drag" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--surface-2)', background: c.id === selId ? 'var(--surface-2)' : 'transparent', color: c.id === selId ? 'var(--text)' : 'var(--text-2)', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ color: 'var(--text-3)', display: 'flex', flex: 'none' }}>{CH_ICON[c.type]}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
          </button>
        ))}
      </div>

      {/* редактор доступа */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!sel ? <div style={{ color: 'var(--text-3)', padding: 30, textAlign: 'center' }}>Выберите канал</div> : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 22px', maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-3)', display: 'flex' }}>{CH_ICON[sel.type]}</span>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{sel.name}</span>
            </div>
            {/* приватность */}
            <button onClick={togglePrivate} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: '1px solid var(--border)', background: isPrivate ? 'var(--accent-tint)' : 'var(--win)', color: isPrivate ? 'var(--accent)' : 'var(--text)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', margin: '12px 0 18px' }}>
              {isPrivate ? <Lock size={17} /> : <Globe size={17} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{isPrivate ? 'Приватный канал' : 'Публичный канал'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{isPrivate ? 'Виден только ролям с разрешением «Просматривать каналы»' : 'Виден всем участникам. Нажмите, чтобы скрыть от @everyone'}</div>
              </div>
            </button>

            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-3)', marginBottom: 8 }}>ДОСТУП ПО РОЛЯМ</div>
            {loading ? <div style={{ color: 'var(--text-3)', padding: 12 }}>Загрузка…</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {targets.map((role) => (
                  <div key={role.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                      <span style={{ width: 11, height: 11, borderRadius: '50%', background: role.color || DEFAULT_ROLE_COLOR, flex: 'none' }} />
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{role.isDefault ? '@everyone' : role.name}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {permsForChannel(sel.type).map((p) => (
                        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{labelOf(p)}</span>
                          <TriToggle value={triOf(role.id, p)} onChange={(v) => setTri(role.id, p, v)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TriToggle({ value, onChange }: { value: Tri; onChange: (v: Tri) => void }) {
  const opts: { v: Tri; icon: React.ReactNode; on: string }[] = [
    { v: 'deny', icon: <X size={14} />, on: 'var(--danger)' },
    { v: 'neutral', icon: <Minus size={14} />, on: 'var(--text-2)' },
    { v: 'allow', icon: <Check size={14} />, on: 'var(--green)' },
  ]
  return (
    <div style={{ display: 'flex', background: 'var(--win)', border: '1px solid var(--border-2)', borderRadius: 9, overflow: 'hidden', flex: 'none' }}>
      {opts.map((o) => {
        const active = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} className="no-drag" title={o.v === 'allow' ? 'Разрешить' : o.v === 'deny' ? 'Запретить' : 'Нейтрально'} style={{ width: 36, height: 30, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? o.on : 'transparent', color: active ? '#fff' : 'var(--text-3)' }}>{o.icon}</button>
        )
      })}
    </div>
  )
}
