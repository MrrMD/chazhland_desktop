import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Минимальный безопасный мост: только то, что нужно UI (TZ р.6 — IPC через contextBridge)
contextBridge.exposeInMainWorld('chazh', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:isMaximized'),
  // уведомления
  notify: (p: { title: string; body: string; channelId?: string }) => ipcRenderer.invoke('notify:show', p),
  onNotificationClick: (cb: (d: { channelId: string }) => void) => {
    const h = (_e: IpcRendererEvent, d: { channelId: string }) => cb(d)
    ipcRenderer.on('notif:clicked', h)
    return () => ipcRenderer.removeListener('notif:clicked', h)
  },
  setBadge: (count: number) => ipcRenderer.send('app:badge', count),
  // глобальный тумблер микрофона
  setMicHotkey: (accel: string | null): Promise<string | null> => ipcRenderer.invoke('voice:setMicHotkey', accel),
  onToggleMic: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('voice:toggle-mic', h)
    return () => ipcRenderer.removeListener('voice:toggle-mic', h)
  },
  // трансляция системного звука при демонстрации экрана (loopback берётся в main)
  setShareAudio: (on: boolean): Promise<void> => ipcRenderer.invoke('screen:setAudio', on),
  // совместный просмотр торрентов: движок в main, отдаёт локальный stream-URL для <video>
  torrentStart: (p: { magnet?: string; infoHash?: string }) => ipcRenderer.invoke('torrent:start', p),
  torrentStop: (token?: string) => ipcRenderer.invoke('torrent:stop', token),
  torrentSelftest: () => ipcRenderer.invoke('torrent:selftest'),
  onTorrentProgress: (cb: (p: unknown) => void) => {
    const h = (_e: IpcRendererEvent, p: unknown) => cb(p)
    ipcRenderer.on('torrent:progress', h)
    return () => ipcRenderer.removeListener('torrent:progress', h)
  },
})

// выгрузка/перезагрузка рендерера — снимаем глобальный хоткей, чтобы он не остался в ОС
window.addEventListener('beforeunload', () => { ipcRenderer.invoke('voice:setMicHotkey', null).catch(() => {}) })
