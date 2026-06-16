import { useEffect, useRef } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import type { RemoteTrack } from 'livekit-client'

// Просмотр чужой демонстрации экрана (входящий screen-share видео-трек из LiveKit).
export function ScreenSharePane({ track, by, full, onToggleFull }: { track: RemoteTrack; by: string | null; full?: boolean; onToggleFull?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    track.attach(v)
    return () => { track.detach(v) }
  }, [track])

  return (
    <div style={{ flex: full ? 1 : 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0e0d0c', position: 'relative', borderRight: full ? 'none' : '1px solid var(--border)' }}>
      <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      <button onClick={onToggleFull} className="no-drag" title={full ? 'Свернуть' : 'На весь экран'} style={{ position: 'absolute', right: 16, top: 16, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 11, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{full ? <Minimize size={17} /> : <Maximize size={17} />}</button>
      <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{by ?? 'кто-то'} демонстрирует экран</span>
      </div>
    </div>
  )
}
