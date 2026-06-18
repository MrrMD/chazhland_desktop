export {}

declare global {
  interface TorrentStartResult {
    ok: boolean
    token?: string
    streamUrl?: string
    name?: string
    length?: number
    webPlayable?: boolean // true → играет <video>; false → нужен mpv (экзотический кодек)
    error?: string
  }
  interface TorrentProgress {
    token: string
    progress: number
    downloaded: number
    length: number
    downloadSpeed: number
    numPeers: number
    ready: boolean
  }
  // события плеера mpv (из main по 'mpv:event')
  type MpvEvent =
    | { type: 'ready' }
    | { type: 'loaded' }
    | { type: 'time-pos'; value: number }
    | { type: 'pause'; value: boolean }
    | { type: 'end'; reason?: string }
    | { type: 'exit' }
    | { type: 'spawn-error'; error: string }
  interface ChazhBridge {
    platform: NodeJS.Platform
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    notify: (p: { title: string; body: string; channelId?: string }) => Promise<void>
    onNotificationClick: (cb: (d: { channelId: string }) => void) => () => void
    setBadge: (count: number) => void
    setMicHotkey: (accel: string | null) => Promise<string | null>
    onToggleMic: (cb: () => void) => () => void
    /** Захватывать ли системный звук при демонстрации экрана (loopback; реально только Windows). */
    setShareAudio: (on: boolean) => Promise<void>
    /** Запустить торрент в main, получить локальный stream-URL для плеера. */
    torrentStart: (p: { magnet?: string; infoHash?: string }) => Promise<TorrentStartResult>
    /** Остановить торрент (по токену из torrentStart) и очистить кэш. */
    torrentStop: (token?: string) => Promise<{ ok: boolean }>
    /** Диагностика для проверки упакованной Windows-сборки. */
    torrentSelftest: () => Promise<{ ok: boolean; nodeVersion?: string; webtorrent?: boolean; ready?: boolean; error?: string }>
    /** Подписка на прогресс загрузки торрента; возвращает функцию отписки. */
    onTorrentProgress: (cb: (p: TorrentProgress) => void) => () => void
    /** Плеер mpv (MKV/HEVC и пр.): загрузить URL-поток. */
    mpvLoad: (p: { url: string; paused?: boolean; start?: number }) => Promise<{ ok: boolean; error?: string }>
    mpvPause: (paused: boolean) => Promise<{ ok: boolean }>
    mpvSeek: (sec: number) => Promise<{ ok: boolean }>
    mpvStop: () => Promise<{ ok: boolean }>
    /** Подписка на события mpv (time-pos/pause/loaded/end/exit); возвращает отписку. */
    onMpvEvent: (cb: (e: MpvEvent) => void) => () => void
  }
  interface Window {
    /** Мост из preload (electron/preload.ts). Отсутствует при запуске в обычном браузере. */
    chazh?: ChazhBridge
  }
}
