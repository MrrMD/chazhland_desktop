import { useEffect, useRef } from 'react'
import { Maximize, Minimize, ChevronDown } from 'lucide-react'
import type { RemoteTrack } from 'livekit-client'
import type { ScreenShare } from '@/lib/voice'

const paneBtn: React.CSSProperties = { border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 11, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// Просмотр чужой демонстрации экрана (входящий screen-share видео-трек из LiveKit).
export function ScreenSharePane({ track, by, full, onToggleFull, onCollapse, screens, activeId, onSelect, nameOf }: { track: RemoteTrack; by: string | null; full?: boolean; onToggleFull?: () => void; onCollapse?: () => void; screens?: ScreenShare[]; activeId?: string | null; onSelect?: (id: string) => void; nameOf?: (userId: string) => string | undefined }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    track.attach(v)
    return () => { track.detach(v) }
  }, [track])

  const multiple = (screens?.length ?? 0) > 1
  // имя шарящего — из списка участников по userId (имя из токена LiveKit бывает пустым → иначе UUID)
  const nameFor = (s: ScreenShare) => nameOf?.(s.userId) || s.by
  const active = screens?.find((s) => s.id === activeId)
  const activeName = (active ? nameFor(active) : by) || 'кто-то'

  return (
    <div style={{ flex: full ? 1 : 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0e0d0c', position: 'relative', borderRight: full ? 'none' : '1px solid var(--border)' }}>
      <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      {/* переключатель, когда демонстраций несколько */}
      {multiple && (
        <div className="no-drag" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, maxWidth: '64%', overflowX: 'auto', background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: 5, backdropFilter: 'blur(6px)' }}>
          {screens!.map((s) => (
            <button key={s.id} onClick={() => onSelect?.(s.id)} className="no-drag" title={`Демонстрация: ${nameFor(s)}`} style={{ flex: 'none', border: 'none', cursor: 'pointer', borderRadius: 24, padding: '6px 13px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', background: s.id === activeId ? 'var(--accent)' : 'rgba(255,255,255,.12)', color: '#fff' }}>{nameFor(s)}</button>
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', right: 16, top: 16, display: 'flex', gap: 8 }}>
        {onCollapse && !full && <button onClick={onCollapse} className="no-drag" title="Свернуть демонстрацию" style={paneBtn}><ChevronDown size={18} /></button>}
        <button onClick={onToggleFull} className="no-drag" title={full ? 'Выйти из полноэкранного' : 'На весь экран'} style={paneBtn}>{full ? <Minimize size={17} /> : <Maximize size={17} />}</button>
      </div>
      <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{activeName} демонстрирует экран</span>
      </div>
    </div>
  )
}
