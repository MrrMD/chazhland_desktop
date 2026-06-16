import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { ws } from '@/lib/ws'
import { toast } from '@/lib/toast'
import type { WatchAction, WatchState } from '@/lib/types'

export function WatchView({ channelId }: { channelId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const remote = useRef<WatchState | null>(null) // последнее авторитетное состояние (синхронно)
  const loadedUrl = useRef<string | null>(null)
  const [state, setState] = useState<WatchState | null>(null)
  const [urlInput, setUrlInput] = useState('')

  function effectivePos(s: WatchState) {
    return s.paused ? s.positionSeconds : s.positionSeconds + Math.max(0, (Date.now() - s.updatedAt) / 1000)
  }

  function apply(s: WatchState) {
    remote.current = s // синхронно ДО видео-операций — чтобы self-induced события подавились в send()
    setState(s)
    const v = videoRef.current
    if (!v || !s.url) return
    if (s.url !== loadedUrl.current) { v.src = s.url; loadedUrl.current = s.url }
    const target = effectivePos(s)
    if (Math.abs(v.currentTime - target) > 1.5) { try { v.currentTime = target } catch { /* not ready */ } }
    if (s.paused) { if (!v.paused) v.pause() } else { v.play().catch(() => {}) }
  }

  function send(action: WatchAction) {
    const v = videoRef.current
    if (!v) return
    const r = remote.current
    if (action === 'PLAY' && r && !r.paused) return
    if (action === 'PAUSE' && r && r.paused) return
    if (action === 'SEEK' && r && Math.abs(v.currentTime - effectivePos(r)) < 1.5) return
    ws.sendWatchControl(channelId, action, v.currentTime)
  }

  useEffect(() => {
    let alive = true
    loadedUrl.current = null
    remote.current = null
    setState(null)
    api.watchState(channelId).then((s) => { if (alive && s) apply(s) }).catch(() => {})
    const off = ws.onWatch(channelId, (s) => { if (alive) apply(s) })
    // мягкая реконсиляция дрейфа (сервер шлёт состояние только на действия)
    const iv = window.setInterval(() => {
      const r = remote.current; const v = videoRef.current
      if (!r || r.paused || !v || !r.url) return
      const target = effectivePos(r)
      if (Math.abs(v.currentTime - target) > 2.5) { try { v.currentTime = target } catch { /* */ } }
    }, 4000)
    return () => {
      alive = false
      off()
      window.clearInterval(iv)
      videoRef.current?.pause() // остановить воспроизведение при уходе с канала
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  async function loadUrl() {
    const url = urlInput.trim()
    if (!url) return
    setUrlInput('')
    try { apply(await api.setWatchSource(channelId, url)) } catch { toast.error('Не удалось загрузить источник видео') }
  }
  function stop() {
    api.stopWatch(channelId).catch(() => {})
    remote.current = null
    loadedUrl.current = null
    setState(null)
    const v = videoRef.current
    if (v) { v.pause(); v.removeAttribute('src'); v.load() }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0d0c', minHeight: 0, padding: 16, position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, background: '#000', display: state?.url ? 'block' : 'none' }}
          onPlay={() => send('PLAY')}
          onPause={() => send('PAUSE')}
          onSeeked={() => send('SEEK')}
        />
        {!state?.url && (
          <div style={{ textAlign: 'center', color: '#8a847a' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#e9e3d8' }}>Кинозал пуст</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Вставьте ссылку на видео ниже — все увидят синхронно</div>
          </div>
        )}
        {state?.url && (
          <div style={{ position: 'absolute', left: 22, top: 22, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: state.paused ? '#e0b43a' : '#2faa6a' }} />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{state.paused ? 'на паузе' : 'идёт'} · синхрон</span>
          </div>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
        <div className="field" style={{ flex: 1, padding: '10px 14px' }}>
          <span style={{ color: 'var(--text-3)' }}>🔗</span>
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://… (mp4/webm)" onKeyDown={(e) => { if (e.key === 'Enter') loadUrl() }} />
        </div>
        <button className="accent-btn no-drag" onClick={loadUrl} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700 }}>Загрузить</button>
        {state?.url && <button className="pill no-drag" onClick={stop} style={{ padding: '10px 14px', fontWeight: 600 }}>Стоп</button>}
      </div>
    </div>
  )
}
