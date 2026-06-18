import { useEffect, useRef, useState } from 'react'
import { Film, Link2, Loader2, MonitorPlay } from 'lucide-react'
import { api } from '@/lib/api'
import { ws } from '@/lib/ws'
import { toast } from '@/lib/toast'
import type { WatchAction, WatchState, WatchSourceKind } from '@/lib/types'

type Issue = { kind: 'codec' | 'failed' | 'link' | 'nobridge'; msg?: string }
type Player = 'video' | 'mpv' // <video> для mp4/прямых ссылок; mpv (отдельное окно) для MKV/HEVC

export function WatchView({ channelId }: { channelId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const remote = useRef<WatchState | null>(null)
  const loadedKey = useRef<string | null>(null) // что загружено в активный плеер
  const resolved = useRef<{ key: string; url: string | null; player: Player } | null>(null)
  const issueRef = useRef<Issue | null>(null)
  const torrentToken = useRef<string | null>(null)
  const applyGen = useRef(0)
  // mpv-состояние
  const mpvPos = useRef(0) // последняя time-pos из mpv
  const mpvSuppressUntil = useRef(0) // подавление эха: пока мы сами рулим mpv, его события не шлём обратно
  const mpvActive = useRef(false)
  const [state, setState] = useState<WatchState | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [issue, setIssue] = useState<Issue | null>(null)
  const [buffering, setBuffering] = useState(false)
  const [dl, setDl] = useState<{ pct: number; peers: number } | null>(null)
  const [mpvMode, setMpvMode] = useState(false) // играем во внешнем окне mpv

  function effectivePos(s: WatchState) {
    return s.paused ? s.positionSeconds : s.positionSeconds + Math.max(0, (Date.now() - s.updatedAt) / 1000)
  }
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
  async function stopMpvIfAny() {
    if (mpvActive.current) { mpvActive.current = false; setMpvMode(false); try { await window.chazh?.mpvStop() } catch { /* */ } }
  }

  // Резолвит источник: url + каким плеером играть (null url = не играем, причина в issueRef).
  async function resolve(s: WatchState): Promise<void> {
    const key = sourceKey(s)
    if (resolved.current?.key === key) return
    const kind: WatchSourceKind = s.source?.kind ?? 'DIRECT'
    if (kind === 'DIRECT') {
      await stopTorrentIfAny(); await stopMpvIfAny()
      issueRef.current = null
      resolved.current = { key, url: s.source?.url ?? s.url, player: 'video' }
      return
    }
    if (kind === 'TORRENT') {
      if (!window.chazh?.torrentStart) { await stopMpvIfAny(); await stopTorrentIfAny(); issueRef.current = { kind: 'nobridge' }; resolved.current = { key, url: null, player: 'video' }; return }
      await stopMpvIfAny(); await stopTorrentIfAny()
      setBuffering(true)
      const res = await window.chazh.torrentStart({ magnet: s.source?.url ?? undefined, infoHash: s.source?.infoHash ?? undefined })
        .catch((e) => ({ ok: false, error: String(e?.message ?? e) } as TorrentStartResult))
      setBuffering(false)
      if (res.ok && res.token && res.streamUrl) {
        torrentToken.current = res.token
        issueRef.current = null
        // mp4/webm → <video>; экзотика (MKV/HEVC) → mpv-окно (если мост доступен)
        const mpvAvailable = typeof window.chazh?.mpvLoad === 'function'
        if (!res.webPlayable && !mpvAvailable) { issueRef.current = { kind: 'codec' }; resolved.current = { key, url: null, player: 'video' }; return }
        resolved.current = { key, url: res.streamUrl, player: res.webPlayable ? 'video' : 'mpv' }
      } else {
        issueRef.current = { kind: 'failed', msg: res.error }
        resolved.current = { key, url: null, player: 'video' }
      }
      return
    }
    await stopTorrentIfAny(); await stopMpvIfAny()
    issueRef.current = { kind: 'link' }
    resolved.current = { key, url: null, player: 'video' }
  }

  async function apply(s: WatchState) {
    const gen = ++applyGen.current
    remote.current = s
    setState(s)
    if (!s.url) {
      await stopTorrentIfAny(); await stopMpvIfAny()
      resolved.current = null; issueRef.current = null; setIssue(null)
      const v0 = videoRef.current
      if (v0 && loadedKey.current) { v0.pause(); v0.removeAttribute('src'); v0.load() }
      loadedKey.current = null
      return
    }
    await resolve(s)
    if (gen !== applyGen.current) return
    const r = resolved.current
    if (!r) return
    if (r.url == null) { setIssue(issueRef.current); return }
    setIssue(null)

    if (r.player === 'mpv') {
      // ВНЕШНЕЕ окно mpv: грузим при смене источника, дальше гоним паузу/перемотку из состояния
      mpvActive.current = true; setMpvMode(true)
      if (r.key !== loadedKey.current) {
        loadedKey.current = r.key
        mpvSuppressUntil.current = Date.now() + 1500
        await window.chazh?.mpvLoad({ url: r.url, paused: s.paused, start: effectivePos(s) })
        return
      }
      mpvSuppressUntil.current = Date.now() + 800
      await window.chazh?.mpvPause(s.paused)
      const target = effectivePos(s)
      if (Math.abs(mpvPos.current - target) > 1.5) await window.chazh?.mpvSeek(target)
      return
    }

    // встроенный <video>
    const v = videoRef.current
    if (!v) return
    if (r.key !== loadedKey.current) { v.src = r.url; loadedKey.current = r.key }
    const target = effectivePos(s)
    if (Math.abs(v.currentTime - target) > 1.5) { try { v.currentTime = target } catch { /* */ } }
    if (s.paused) { if (!v.paused) v.pause() } else { v.play().catch(() => {}) }
  }

  // отправка действия в комнату; position берём от активного плеера
  function sendControl(action: WatchAction, position: number) {
    const r = remote.current
    if (action === 'PLAY' && r && !r.paused) return
    if (action === 'PAUSE' && r && r.paused) return
    if (action === 'SEEK' && r && Math.abs(position - effectivePos(r)) < 1.5) return
    ws.sendWatchControl(channelId, action, position)
  }
  function sendFromVideo(action: WatchAction) {
    const v = videoRef.current
    if (!v) return
    sendControl(action, v.currentTime)
  }

  useEffect(() => {
    let alive = true
    loadedKey.current = null; resolved.current = null; remote.current = null
    issueRef.current = null; mpvActive.current = false; mpvPos.current = 0
    setIssue(null); setBuffering(false); setMpvMode(false); setState(null)
    api.watchState(channelId).then((s) => { if (alive && s) apply(s) }).catch(() => {})
    const off = ws.onWatch(channelId, (s) => { if (alive) apply(s) })
    const offProg = window.chazh?.onTorrentProgress?.((p) => {
      if (!alive || !torrentToken.current || p.token !== torrentToken.current) return
      setDl({ pct: Math.round((p.progress ?? 0) * 100), peers: p.numPeers ?? 0 })
    })
    const offMpv = window.chazh?.onMpvEvent?.((e) => {
      if (!alive || !mpvActive.current) return
      if (e.type === 'time-pos') { mpvPos.current = e.value }
      else if (e.type === 'pause') {
        if (Date.now() < mpvSuppressUntil.current) return // наша же команда — не эхо
        sendControl(e.value ? 'PAUSE' : 'PLAY', mpvPos.current)
      } else if (e.type === 'spawn-error') { mpvActive.current = false; setMpvMode(false); setIssue({ kind: 'failed', msg: e.error }) }
      else if (e.type === 'exit') { mpvActive.current = false; setMpvMode(false) }
    })
    // дрейф-реконсиляция (только для <video>; mpv ведём из apply)
    const iv = window.setInterval(() => {
      const r = remote.current; const v = videoRef.current
      if (!r || r.paused || !v || issueRef.current || resolved.current?.player !== 'video' || resolved.current?.url == null) return
      const target = effectivePos(r)
      if (Math.abs(v.currentTime - target) > 2.5) { try { v.currentTime = target } catch { /* */ } }
    }, 4000)
    return () => {
      alive = false; off(); offProg?.(); offMpv?.(); window.clearInterval(iv)
      videoRef.current?.pause(); stopTorrentIfAny(); stopMpvIfAny()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  async function loadUrl() {
    const text = urlInput.trim()
    if (!text) return
    setUrlInput('')
    let req: { kind: WatchSourceKind; url?: string; infoHash?: string }
    if (/^magnet:\?/i.test(text)) req = { kind: 'TORRENT', url: text }
    else if (/^[0-9a-fA-F]{40}$/.test(text) || /^[A-Za-z2-7]{32}$/.test(text)) req = { kind: 'TORRENT', infoHash: text }
    else req = { kind: 'DIRECT', url: text }
    try { await apply(await api.setWatchSource(channelId, req)) } catch { toast.error('Не удалось загрузить источник') }
  }
  function stop() {
    api.stopWatch(channelId).catch(() => {})
    applyGen.current++
    stopTorrentIfAny(); stopMpvIfAny()
    remote.current = null; resolved.current = null; loadedKey.current = null; issueRef.current = null
    setIssue(null); setBuffering(false); setState(null)
    const v = videoRef.current
    if (v) { v.pause(); v.removeAttribute('src'); v.load() }
  }

  const issueText: Record<Issue['kind'], { title: string; sub: string }> = {
    codec: { title: 'Формат пока не поддерживается', sub: 'mp4-раздачи играются в окне. Для MKV/HEVC нужен mpv — установи его (brew install mpv / winget install mpv) и перезапусти.' },
    failed: { title: 'Не удалось загрузить', sub: (issue?.msg ?? 'Возможно, нет раздающих. Попробуй другую раздачу.') },
    link: { title: 'Ссылки на страницы пока не поддерживаются', sub: 'Появятся позже (yt-dlp + mpv).' },
    nobridge: { title: 'Движок не загружен', sub: 'Полностью перезапусти приложение (npm run dev).' },
  }
  const showVideo = !!state?.url && !issue && !buffering && !mpvMode
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0d0c', minHeight: 0, padding: 16, position: 'relative' }}>
        <video
          ref={videoRef}
          controls
          style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, background: '#000', display: showVideo ? 'block' : 'none' }}
          onPlay={() => sendFromVideo('PLAY')}
          onPause={() => sendFromVideo('PAUSE')}
          onSeeked={() => sendFromVideo('SEEK')}
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
        {buffering && state?.url && !issue && (
          <div style={{ textAlign: 'center', color: '#c7c0b5' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Loader2 size={34} style={{ animation: 'spin 1s linear infinite' }} /></div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#e9e3d8' }}>Подключаемся к раздаче…</div>
            {dl && <div style={{ fontSize: 13, marginTop: 4 }}>загружено {dl.pct}% · пиров: {dl.peers}</div>}
          </div>
        )}
        {mpvMode && !issue && (
          <div style={{ textAlign: 'center', color: '#c7c0b5', maxWidth: 360 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><MonitorPlay size={40} /></div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#e9e3d8' }}>Играем в окне mpv</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>MKV/HEVC открыт во внешнем плеере mpv, синхронно с комнатой. {dl && dl.pct < 100 ? `Загружено ${dl.pct}%.` : ''} (Встраивание в окно — следующий шаг.)</div>
          </div>
        )}
        {issue && (
          <div style={{ textAlign: 'center', color: '#8a847a', maxWidth: 380 }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Film size={40} /></div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#e9e3d8' }}>{issueText[issue.kind].title}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{issueText[issue.kind].sub}</div>
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
