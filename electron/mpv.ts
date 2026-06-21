// Плеер mpv для форматов, которые <video> не тянет (MKV/HEVC/AC3/10-bit/…). Запускаем системный mpv
// (или MPV_PATH) и играем HTTP-поток торрента, управляя по JSON-IPC (loadfile/pause/seek; наблюдаем
// time-pos/pause/eof). Пока mpv открывается ОТДЕЛЬНЫМ окном — встраивание в окно Electron (--wid) и
// бандл бинаря под Windows — следующий шаг. Безопасность: --no-config (чужой конфиг не подцепит run/shell).
import { app, ipcMain, type BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import dns from 'node:dns'

// Вендоренный бинарь (mpv.exe / yt-dlp.exe): прод — extraResources → resourcesPath/mpv/;
// dev — <appRoot>/resources/mpv/<platform>-<arch>/. Под Windows бинари кладёт тестер (см. resources/mpv/README).
function vendoredBin(name: string): string | null {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const plat = `${process.platform}-${process.arch}`
  const candidates = [
    path.join(process.resourcesPath || '', 'mpv', exe),                          // упакованное приложение
    path.join(process.env.APP_ROOT || app.getAppPath(), 'resources', 'mpv', plat, exe), // dev
  ]
  for (const c of candidates) { try { if (c && fs.existsSync(c)) return c } catch { /* */ } }
  return null
}

function mpvBinary(): string {
  if (process.env.MPV_PATH) return process.env.MPV_PATH
  const vend = vendoredBin('mpv')
  if (vend) return vend
  // ⚠️ GUI-приложения на macOS наследуют урезанный PATH БЕЗ /opt/homebrew/bin (Apple Silicon) и
  // /usr/local/bin (Intel) — поэтому spawn('mpv') не находит brew-mpv. Ищем бинарь в реальных местах.
  const candidates = [
    '/opt/homebrew/bin/mpv', '/usr/local/bin/mpv', '/usr/bin/mpv',
    'C:\\Program Files\\mpv\\mpv.exe', 'C:\\Program Files\\mpv.net\\mpvnet.exe',
  ]
  for (const c of candidates) { try { if (fs.existsSync(c)) return c } catch { /* */ } }
  return 'mpv' // запасной вариант — из PATH
}

// Путь к yt-dlp для mpv ytdl_hook (LINK-источники: YouTube/VK/…). null → mpv поищет в PATH сам.
function ytDlpPath(): string | null {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH
  const vend = vendoredBin('yt-dlp')
  if (vend) return vend
  for (const c of ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp']) {
    try { if (fs.existsSync(c)) return c } catch { /* */ }
  }
  return null
}

// SSRF-защита для LINK: page-URL приходит из комнаты (недоверенный) → пускаем ТОЛЬКО https на публичный хост.
function isBlockedIp(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::1' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) return true // loopback/link-local/ULA v6
  const m = v.replace(/^::ffff:/, '').match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 127 || a === 10 || a === 0) return true                  // loopback / private / «this host»
  if (a === 169 && b === 254) return true                            // link-local + metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true                   // private
  if (a === 192 && b === 168) return true                            // private
  if (a === 100 && b >= 64 && b <= 127) return true                  // CGNAT
  return false
}
async function validateLinkUrl(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let u: URL
  try { u = new URL(raw) } catch { return { ok: false, error: 'Битая ссылка' } }
  if (u.protocol !== 'https:') return { ok: false, error: 'Разрешены только https-ссылки' }
  try {
    const addrs = await dns.promises.lookup(u.hostname, { all: true })
    if (addrs.some((a) => isBlockedIp(a.address))) return { ok: false, error: 'Недопустимый адрес (внутренний)' }
  } catch { return { ok: false, error: 'Не удалось разрешить хост' } }
  return { ok: true }
}

function ipcAddress(): string {
  const id = crypto.randomBytes(6).toString('hex')
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\chazh-mpv-${id}`
    : path.join(os.tmpdir(), `chazh-mpv-${id}.sock`)
}

interface Session {
  proc: ChildProcess
  sock: net.Socket | null
  reqId: number
  buf: string
  address: string
}
interface MpvTrack { id: number; title?: string; lang?: string; codec?: string }
let session: Session | null = null
let getWindow: () => BrowserWindow | null = () => null

// состояние для корректного синхрона:
let pausedForCache = false      // mpv добуферивает — это НЕ ручная пауза, не рассылаем в комнату
let loadingFlag = false         // идёт загрузка файла — глушим всплеск pause/seek до file-loaded
let lastSentPause: boolean | null = null // последняя пауза, которую задали МЫ — гасим её эхо
let durationSec = 0             // длительность для клампа seek

function emit(payload: unknown): void {
  const w = getWindow()
  if (w && !w.isDestroyed()) w.webContents.send('mpv:event', payload)
}

function sendCmd(command: unknown[]): void {
  const s = session
  if (!s?.sock) return
  try { s.sock.write(JSON.stringify({ command, request_id: ++s.reqId }) + '\n') } catch { /* */ }
}

function onIpcData(chunk: Buffer): void {
  const s = session
  if (!s) return
  s.buf += chunk.toString('utf8')
  let nl: number
  while ((nl = s.buf.indexOf('\n')) >= 0) {
    const line = s.buf.slice(0, nl).trim()
    s.buf = s.buf.slice(nl + 1)
    if (!line) continue
    let msg: any
    try { msg = JSON.parse(line) } catch { continue }
    if (msg.event === 'property-change') {
      if (msg.name === 'time-pos' && typeof msg.data === 'number') emit({ type: 'time-pos', value: msg.data })
      else if (msg.name === 'duration') { if (typeof msg.data === 'number') durationSec = msg.data }
      else if (msg.name === 'paused-for-cache') { pausedForCache = !!msg.data; emit({ type: 'buffering', value: pausedForCache }) }
      else if (msg.name === 'track-list' && Array.isArray(msg.data)) {
        const audio: MpvTrack[] = []
        const sub: MpvTrack[] = []
        let aid: number | false = false
        let sid: number | false = false
        for (const t of msg.data) {
          const item: MpvTrack = { id: t.id, title: t.title || undefined, lang: t.lang || undefined, codec: t.codec || undefined }
          if (t.type === 'audio') { audio.push(item); if (t.selected) aid = t.id }
          else if (t.type === 'sub') { sub.push(item); if (t.selected) sid = t.id }
        }
        emit({ type: 'tracks', audio, sub, aid, sid })
      }
      else if (msg.name === 'aid') emit({ type: 'track-change', kind: 'audio', id: typeof msg.data === 'number' ? msg.data : false })
      else if (msg.name === 'sid') emit({ type: 'track-change', kind: 'sub', id: typeof msg.data === 'number' ? msg.data : false })
      else if (msg.name === 'pause') {
        const paused = !!msg.data
        if (loadingFlag) return                                              // всплеск во время загрузки — игнор
        if (pausedForCache) return                                           // добуферивание, не ручная пауза
        if (lastSentPause !== null && paused === lastSentPause) { lastSentPause = null; return } // эхо нашей команды
        emit({ type: 'pause', value: paused })
      }
    } else if (msg.event === 'end-file') {
      emit({ type: 'end', reason: msg.reason })
    } else if (msg.event === 'file-loaded') {
      loadingFlag = false
      emit({ type: 'loaded' })
    }
  }
}

function connectIpc(): void {
  let tries = 0
  const attempt = () => {
    if (!session || session.sock) return
    const sock = net.connect(session.address)
    sock.on('connect', () => {
      if (!session) { sock.destroy(); return }
      session.sock = sock
      sendCmd(['observe_property', 1, 'time-pos'])
      sendCmd(['observe_property', 2, 'pause'])
      sendCmd(['observe_property', 3, 'paused-for-cache'])
      sendCmd(['observe_property', 4, 'track-list'])
      sendCmd(['observe_property', 5, 'aid'])
      sendCmd(['observe_property', 6, 'sid'])
      sendCmd(['observe_property', 7, 'duration'])
      emit({ type: 'ready' })
    })
    sock.on('data', onIpcData)
    sock.on('error', () => { try { sock.destroy() } catch { /* */ } if (session && !session.sock && tries++ < 60) setTimeout(attempt, 100) })
    sock.on('close', () => { if (session && session.sock === sock) session.sock = null })
  }
  attempt()
}

async function load(url: string, paused: boolean, startSec: number): Promise<{ ok: boolean; error?: string }> {
  await stop()
  loadingFlag = true; pausedForCache = false; lastSentPause = null; durationSec = 0
  const address = ipcAddress()
  const ytdl = ytDlpPath()
  const args = [
    '--no-config', '--no-terminal', '--idle=yes', '--force-window=yes', '--keep-open=yes',
    `--input-ipc-server=${address}`,
    `--pause=${paused ? 'yes' : 'no'}`,
    `--start=${Math.max(0, Math.floor(startSec))}`,
    '--title=chazhland · кинозал',
    // LINK-источники: ytdl_hook резолвит page-URL (YouTube/VK/…). Для loopback-потока торрента не активируется.
    ...(ytdl ? [`--script-opts=ytdl_hook-ytdl_path=${ytdl}`] : []),
    url,
  ]
  let proc: ChildProcess
  try {
    proc = spawn(mpvBinary(), args, { stdio: 'ignore' })
  } catch (e: any) {
    return { ok: false, error: 'mpv не запустился (установлен ли он?): ' + (e?.message ?? e) }
  }
  session = { proc, sock: null, reqId: 0, buf: '', address }
  proc.on('error', (e: any) => {
    if (session?.proc === proc) { session = null; emit({ type: 'spawn-error', error: 'mpv не найден — установи mpv (brew install mpv / winget install mpv)' }) }
    void e
  })
  proc.on('exit', () => { if (session?.proc === proc) { session = null; emit({ type: 'exit' }) } })
  connectIpc()
  return { ok: true }
}

function setPaused(paused: boolean): void { lastSentPause = paused; sendCmd(['set_property', 'pause', paused]) }
function seek(sec: number): void {
  const clamped = durationSec > 0 ? Math.min(durationSec - 0.5, Math.max(0, sec)) : Math.max(0, sec)
  sendCmd(['set_property', 'time-pos', clamped])
}
function setTrack(prop: 'aid' | 'sid', id: number | false): void { sendCmd(['set_property', prop, id === false ? 'no' : id]) }
function setSpeed(v: number): void { sendCmd(['set_property', 'speed', Number.isFinite(v) ? v : 1]) }

async function stop(): Promise<void> {
  const s = session
  session = null
  loadingFlag = false; pausedForCache = false; lastSentPause = null; durationSec = 0
  if (!s) return
  try { s.sock?.write(JSON.stringify({ command: ['quit'] }) + '\n') } catch { /* */ }
  try { s.sock?.destroy() } catch { /* */ }
  try { s.proc.kill() } catch { /* */ }
}

/** Регистрируется ОДИН раз при whenReady. */
export function registerMpvIpc(getWin: () => BrowserWindow | null): void {
  getWindow = getWin
  ipcMain.handle('mpv:load', (_e, p: { url: string; paused?: boolean; start?: number }) => load(p.url, !!p?.paused, p?.start ?? 0))
  ipcMain.handle('mpv:loadLink', async (_e, p: { url: string; paused?: boolean; start?: number }) => {
    const v = await validateLinkUrl(p?.url ?? '')        // недоверенный page-URL из комнаты — SSRF-гейт перед mpv/yt-dlp
    if (!v.ok) return { ok: false, error: v.error }
    return load(p.url, !!p?.paused, p?.start ?? 0)
  })
  ipcMain.handle('mpv:pause', (_e, paused: boolean) => { setPaused(!!paused); return { ok: true } })
  ipcMain.handle('mpv:seek', (_e, sec: number) => { seek(typeof sec === 'number' ? sec : 0); return { ok: true } })
  ipcMain.handle('mpv:setAudio', (_e, id: number | false) => { setTrack('aid', id); return { ok: true } })
  ipcMain.handle('mpv:setSub', (_e, id: number | false) => { setTrack('sid', id); return { ok: true } })
  ipcMain.handle('mpv:setSpeed', (_e, v: number) => { setSpeed(typeof v === 'number' ? v : 1); return { ok: true } })
  ipcMain.handle('mpv:stop', async () => { await stop(); return { ok: true } })
}

export async function teardownMpv(): Promise<void> { await stop() }
