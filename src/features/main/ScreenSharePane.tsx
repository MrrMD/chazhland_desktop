import { useEffect, useRef, useState } from 'react'
import { Maximize, Minimize, ChevronDown, LayoutGrid, Volume2, VolumeX } from 'lucide-react'
import type { RemoteTrack } from 'livekit-client'
import { voice, type ScreenShare } from '@/lib/voice'

const paneBtn: React.CSSProperties = { border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 11, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// Одна плитка сетки: живое мини-превью чужой демонстрации; клик разворачивает её в фокус.
function ScreenTile({ track, name, onClick }: { track: RemoteTrack; name: string; onClick: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    track.attach(v)
    return () => { track.detach(v) }
  }, [track])
  return (
    <div className="no-drag" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', minHeight: 0, borderRadius: 14, overflow: 'hidden', background: '#000', cursor: 'pointer', border: `2px solid ${hover ? 'var(--accent)' : 'transparent'}`, transition: 'border-color .12s', animation: 'fadeIn .25s ease' }}>
      <video ref={ref} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.55)', borderRadius: 24, padding: '5px 11px', maxWidth: 'calc(100% - 20px)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e0392f', flex: 'none', animation: 'live 1.6s infinite' }} />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      </div>
      {hover && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 24, padding: '7px 14px', fontSize: 12.5, fontWeight: 600 }}><Maximize size={15} /> Развернуть</div>
        </div>
      )}
    </div>
  )
}

// Просмотр чужих демонстраций экрана (входящие screen-share видео-треки из LiveKit).
// Несколько демонстраций → сетка живых плиток (клик = фокус); одна или выбранная → крупно.
export function ScreenSharePane({ full, onToggleFull, onCollapse, screens, onSelect, nameOf }: { full?: boolean; onToggleFull?: () => void; onCollapse?: () => void; screens: ScreenShare[]; onSelect?: (id: string) => void; nameOf?: (userId: string) => string | undefined }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  // имя шарящего — из участников по userId (имя из токена LiveKit бывает пустым → иначе UUID)
  const nameFor = (s: ScreenShare) => nameOf?.(s.userId) || s.by

  // что показываем крупно: явно сфокусированная плитка, либо единственная демонстрация
  const focused = focusedId ? screens.find((s) => s.id === focusedId) ?? null : null
  const single = screens.length === 1 ? screens[0] : null
  const big = focused ?? single
  const showGrid = !big && screens.length > 1

  // фокус-стрим завершился → назад в сетку; «липкий» фокус — когда смотришь один, а подключается ещё
  // один, не прыгаем в сетку, а остаёмся на текущем
  const prevIds = useRef<string[]>([])
  useEffect(() => {
    const ids = screens.map((s) => s.id)
    const prev = prevIds.current
    prevIds.current = ids
    if (focusedId && !ids.includes(focusedId)) { setFocusedId(null); return }
    if (focusedId === null && prev.length === 1 && ids.length > 1) setFocusedId(prev[0])
  }, [screens, focusedId])

  // привязка крупного видео (в режиме сетки <video> не смонтирован — пропускаем)
  const bigTrack = big?.track
  useEffect(() => {
    const v = ref.current
    if (!v || !bigTrack) return
    bigTrack.attach(v)
    return () => { bigTrack.detach(v) }
  }, [bigTrack])

  function focus(id: string) { onSelect?.(id); setFocusedId(id) }

  const cols = Math.min(screens.length, Math.ceil(Math.sqrt(screens.length)))

  return (
    <div style={{ flex: full ? 1 : 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0e0d0c', position: 'relative', borderRight: full ? 'none' : '1px solid var(--border)' }}>
      {showGrid ? (
        <div className="no-drag" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, padding: 12, overflow: 'auto', alignContent: 'center' }}>
          {screens.map((s) => <ScreenTile key={s.id} track={s.track} name={nameFor(s)} onClick={() => focus(s.id)} />)}
        </div>
      ) : (
        <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      )}

      {/* верх-право: все демонстрации (назад в сетку) / свернуть / на весь экран */}
      <div style={{ position: 'absolute', right: 16, top: 16, display: 'flex', gap: 8 }}>
        {!showGrid && screens.length > 1 && <button onClick={() => setFocusedId(null)} className="no-drag" title="Все демонстрации" style={paneBtn}><LayoutGrid size={17} /></button>}
        {onCollapse && !full && <button onClick={onCollapse} className="no-drag" title="Свернуть демонстрацию" style={paneBtn}><ChevronDown size={18} /></button>}
        <button onClick={onToggleFull} className="no-drag" title={full ? 'Выйти из полноэкранного' : 'На весь экран'} style={paneBtn}>{full ? <Minimize size={17} /> : <Maximize size={17} />}</button>
      </div>

      {/* низ-лево: кто демонстрирует + громкость звука демонстрации (только в фокус-режиме) */}
      {big && (
        <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{nameFor(big)} демонстрирует экран</span>
          <StreamVolume />
        </div>
      )}
    </div>
  )
}

// Громкость звука просматриваемой демонстрации (screen-share audio). Кнопка-динамик раскрывает слайдер.
function StreamVolume() {
  const [open, setOpen] = useState(false)
  const [pct, setPct] = useState(() => Math.round(voice.getVolumeSettings().stream * 100))
  function change(v: number) { setPct(v); voice.setStreamVolume(v / 100) }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: open ? 8 : 0, marginLeft: 2 }}>
      <button onClick={() => setOpen((o) => !o)} className="no-drag" title="Громкость звука демонстрации" style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', padding: 0 }}>
        {pct === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      {open && <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => change(Number(e.target.value))} className="no-drag" style={{ width: 92, accentColor: 'var(--accent)', cursor: 'pointer' }} />}
    </span>
  )
}
