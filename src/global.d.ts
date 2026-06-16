export {}

declare global {
  interface ChazhBridge {
    platform: NodeJS.Platform
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  interface Window {
    /** Мост из preload (electron/preload.ts). Отсутствует при запуске в обычном браузере. */
    chazh?: ChazhBridge
  }
}
