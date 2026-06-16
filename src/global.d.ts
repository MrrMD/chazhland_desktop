export {}

declare global {
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
  }
  interface Window {
    /** Мост из preload (electron/preload.ts). Отсутствует при запуске в обычном браузере. */
    chazh?: ChazhBridge
  }
}
