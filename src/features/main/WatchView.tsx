import { useEffect, useRef, useState } from 'react'
import { Film, Link2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { ws } from '@/lib/ws'
import { toast } from '@/lib/toast'
import type { WatchAction, WatchState, WatchSourceKind } from '@/lib/types'

export function WatchView({ channelId }: { channelId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const remote = useRef<WatchState | null>(null) // последнее авторитетное состояние (синхронно)
  const loadedKey = useRef<string | null>(null) // ключ источника, реально загруженного в <video>
  const resolved = useRef<{ key: string; url: string | null } | null>(null) // кэш резолва (url null = не играем)
  const torrentToken = useRef<string | null>(null) // токен активного торрента (для остановки)
  const applyGen = useRef(0) // монотонный токен для async apply (анти-гонка при смене источника во время await)
  const unsupportedRef = useRef(false)
  const [state, setState] = useState<WatchState | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [unsupported, setUnsupported] = useState(false) // источник задан, но эта версия его не играет
  const [buffering, setBuffering] = useState(false)
  const [dl, setDl] = useState<{ pct: number; peers: number } | null>(null) // прогресс торрента

  function effectivePos(s: WatchState) {
    return s.paused ? s.positionSeconds : s.positionSeconds + Math.max(0, (Date.now() - s.updatedAt) / 1000)
  }
  // composite-ключ источника: разные kind с одинаковым ref не должны схлопываться
  function sourceKey(s: WatchState): string {
    const kind = s.source?.kind ?? 'DIRECT'
    return `${kind}:${s.source?.infoHash ?? s.source?.url ?? s.url ?? ''}`
  }

  async function stopTorrentIfAny() {
    const tok = torrentToken.current
    torrentToken.current = null
    setDl(null)
    if (tok) { try { await window.chazh?.torrentStop(tok) } catch { /* */ } }
  }

  // Резолвит источник в URL для <video> (null = эта версия не играет). Для TORRENT запускает движок в main.
  // Кэш по ключу: НЕ перезапускаем торрент на каждое play/pause/seek (они приходят с тем же источником).
  async function resolve(s: WatchState): Promise<void> {
    const key = sourceKey(s)
    if (resolved.current?.key === key) return
    const kind: WatchSourceKind = s.source?.kind ?? 'DIRECT'
    if (kind === 'DIRECT') {
      await stopTorrentIfAny()
      resolved.current = { key, url: s.source?.url ?? s.url }
      return
    }
    if (kind === 'TORRENT' && window.chazh?.torrentStart) {
      await stopTorrentIfAny()
      setBuffering(true)
      const res = await window.chazh
        .torrentStart({ magnet: s.source?.url ?? undefined, infoHash: s.source?.infoHash ?? undefined })
        .catch(() => ({ ok: false } as TorrentStartResult))
      setBuffering(false)
      if (res.ok && res.token) {
        torrentToken.current = res.token
        // webPlayable=false → экзотический кодек (MKV/HEVC): <video> не сыграет, нужен mpv (следующий инкремент)
        resolved.current = { key, url: res.webPlayable ? (res.streamUrl ?? null) : null }
      } else {
        resolved.current = { key, url: null }
        if (res.error) toast.error(res.error)
      }
      return
    }
    // LINK или нет моста (браузер/мок) — пока не поддерживается
    await stopTorrentIfAny()
    resolved.current = { key, url: null }
  }

  async function apply(s: WatchState) {
    const gen = ++applyGen.current
    remote.current = s // синхронно ДО видео-операций — чтобы self-induced события подавились в send()
    setState(s)
    if (!s.url) { // стоп / нет источника
      await stopTorrentIfAny()
      resolved.current = null
      unsupportedRef.current = false
      setUnsupported(false)
      const v0 = videoRef.current
      if (v0 && loadedKey.current) { v0.pause(); v0.removeAttribute('src'); v0.load() }
      loadedKey.current = null
      return
    }
    await resolve(s)
    if (gen !== applyGen.current) return // источник сменился за время резолва — управление у нового apply
    const v = videoRef.current
    const r = resolved.current
    if (!v || !r) return
    if (r.url == null) { // источник есть, но эта версия его не воспроизводит
      unsupportedRef.current = true
      setUnsupported(true)
      if (loadedKey.current) { v.pause(); v.removeAttribute('src'); v.load(); loadedKey.current = null }
      return
    }
    unsupportedRef.current = false
    setUnsupported(false)
    if (r.key !== loadedKey.current) { v.src = r.url; loadedKey.current = r.key }
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
    loadedKey.current = null
    resolved.current = null
    remote.current = null
    unsupportedRef.current = false
    setUnsupported(false)
    setBuffering(false)
    setState(null)
    api.watchState(channelId).then((s) => { if (alive && s) apply(s) }).catch(() => {})
    const off = ws.onWatch(channelId, (s) => { if (alive) apply(s) })
    const offProg = window.chazh?.onTorrentProgress?.((p) => {
      if (!alive || !torrentToken.current || p.token !== torrentToken.current) return
      setDl({ pct: Math.round((p.progress ?? 0) * 100), peers: p.numPeers ?? 0 })
    })
    // мягкая реконсиляция дрейфа (сервер шлёт состояние только на действия)
    const iv = window.setInterval(() => {
      const r = remote.current; const v = videoRef.current
      if (!r || r.paused || !v || unsupportedRef.current || resolved.current?.url == null) return
      const target = effectivePos(r)
      if (Math.abs(v.currentTime - target) > 2.5) { try { v.currentTime = target } catch { /* */ } }
    }, 4000)
    return () => {
      alive = false
      off()
      offProg?.()
      window.clearInterval(iv)
      videoRef.current?.pause() // остановить воспроизведение при уходе с канала
      stopTorrentIfAny()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  async function loadUrl() {
    const text = urlInput.trim()
    if (!text) return
    setUrlInput('')
    // распознаём magnet/infohash → TORRENT, иначе прямую ссылку → DIRECT
    let req: { kind: WatchSourceKind; url?: string; infoHash?: string }
    if (/^magnet:\?/i.test(text)) req = { kind: 'TORRENT', url: text }
    else if (/^[0-9a-fA-F]{40}$/.test(text) || /^[A-Za-z2-7]{32}$/.test(text)) req = { kind: 'TORRENT', infoHash: text }
    else req = { kind: 'DIRECT', url: text }
    try { await apply(await api.setWatchSource(channelId, req)) } catch { toast.error('Не удалось загрузить источник') }
  }
  function stop() {
    api.stopWatch(channelId).catch(() => {})
    applyGen.current++ // отменяем возможный незавершённый apply
    stopTorrentIfAny()
    remote.current = null
    resolved.current = null
    loadedKey.current = null
    unsupportedRef.current = false
    setUnsupported(false)
    setBuffering(false)
    setState(null)
    const v = videoRef.current
    if (v) { v.pause(); v.removeAttribute('src'); v.load() }
  }

  const showVideo = !!state?.url && !unsupported && !buffering
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0d0c', minHeight: 0, padding: 16, position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, background: '#000', display: showVideo ? 'block' : 'none' }}
          onPlay={() => send('PLAY')}
          onPause={() => send('PAUSE')}
          onSeeked={() => send('SEEK')}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
        />
        {!state?.url && (
          <div style={{ textAlign: 'center', color: '#8a847a' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Film size={40} /></div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#e9e3d8' }}>Кинозал пуст</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Вставьте ссылку или magnet ниже — все увидят синхронно</div>
          </div>
        )}
        {buffering && state?.url && !unsupported && (
          <div style={{ textAlign: 'center', color: '#c7c0b5' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={34} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e9e3d8' }}>Подключаемся к раздаче…</div>
            {dl && <div style={{ fontSize: 13, marginTop: 4 }}>загружено {dl.pct}% · пиров: {dl.peers}</div>}
          </div>
        )}
        {unsupported && (
          <div style={{ textAlign: 'center', color: '#8a847a', maxWidth: 360 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Film size={40} /></div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#e9e3d8' }}>Формат пока не поддерживается</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>mp4-раздачи и прямые ссылки играются уже сейчас. MKV/HEVC и ссылки на страницы — в следующей версии (встроенный плеер).</div>
          </div>
        )}
        {showVideo && (
          <div style={{ position: 'absolute', left: 22, top: 22, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: state!.paused ? '#e0b43a' : '#2faa6a' }} />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{state!.paused ? 'на паузе' : 'идёт'} · синхрон</span>
            {dl && dl.pct < 100 && <span style={{ color: '#c7c0b5', fontSize: 12 }}>· {dl.pct}%</span>}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
        <div className="field" style={{ flex: 1, padding: '10px 14px' }}>
          <span style={{ color: 'var(--text-3)', display: 'flex' }}><Link2 size={15} /></span>
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://… (mp4) или magnet:…" onKeyDown={(e) => { if (e.key === 'Enter') loadUrl() }} />
        </div>
        <button className="accent-btn no-drag" onClick={loadUrl} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700 }}>Загрузить</button>
        {state?.url && <button className="pill no-drag" onClick={stop} style={{ padding: '10px 14px', fontWeight: 600 }}>Стоп</button>}
      </div>
    </div>
  )
}
