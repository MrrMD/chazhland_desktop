import { useEffect, useRef } from 'react'
import type { RemoteTrack } from 'livekit-client'

// Просмотр чужой демонстрации экрана (входящий screen-share видео-трек из LiveKit).
export function ScreenSharePane({ track, by }: { track: RemoteTrack; by: string | null }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    track.attach(v)
    return () => { track.detach(v) }
  }, [track])

  return (
    <div style={{ flex: 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0e0d0c', position: 'relative', borderRight: '1px solid var(--border)' }}>
      <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{by ?? 'кто-то'} демонстрирует экран</span>
      </div>
    </div>
  )
}
