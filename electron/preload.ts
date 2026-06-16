import { contextBridge, ipcRenderer } from 'electron'

// Минимальный безопасный мост: только то, что нужно UI (TZ р.6 — IPC через contextBridge)
contextBridge.exposeInMainWorld('chazh', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
})
