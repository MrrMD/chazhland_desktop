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
  }
  interface Window {
    /** Мост из preload (electron/preload.ts). Отсутствует при запуске в обычном браузере. */
    chazh?: ChazhBridge
  }
}
