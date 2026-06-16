import { app, BrowserWindow, ipcMain, shell, desktopCapturer } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM-сборка (package.json "type":"module") — __dirname недоступен, вычисляем сами
const appDir = path.dirname(fileURLToPath(import.meta.url))

// dist-electron/main.js  и  dist/index.html лежат рядом после сборки
process.env.APP_ROOT = path.join(appDir, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1340,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    frame: false, // кастомный titlebar (frameless) — Windows-стиль
    backgroundColor: '#17150f',
    webPreferences: {
      preload: path.join(appDir, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox оставлен выключенным до перевода preload в CJS — см. TZ р.6 (харднинг позже)
      sandbox: false,
      // десктоп-приложение ходит в СВОЙ API (api.chazhland.ru) — CORS/SOP к нему неприменимы.
      // Рендерер грузит только собственный бандл; навигация на чужие URL запрещена (ниже).
      webSecurity: false,
    },
  })

  // window-контролы из рендерера
  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:maximize', () => (win?.isMaximized() ? win?.unmaximize() : win?.maximize()))
  ipcMain.on('win:close', () => win?.close())
  ipcMain.handle('win:isMaximized', () => win?.isMaximized() ?? false)

  // внешние ссылки — в системный браузер, навигация внутри запрещена (TZ р.6)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Демонстрация экрана (Go Live): getDisplayMedia в Electron требует обработчик (TZ р.6).
  // Базово выдаём первый экран; позже — нативный пикер источника.
  win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] })
      .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
      .catch(() => callback({}))
  })

  // Бэк проверяет Origin при WS-handshake (setAllowedOriginPatterns). В dev origin = http://localhost:5173,
  // которого нет в allowedOrigins → /ws отклоняется. Подменяем Origin на разрешённый frontend-домен.
  win.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['http://api.chazhland.ru/*', 'https://api.chazhland.ru/*', 'ws://api.chazhland.ru/*', 'wss://api.chazhland.ru/*'] },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'https://chat.chazhland.ru'
      callback({ requestHeaders: details.requestHeaders })
    },
  )

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' }) // в dev — DevTools (Console/Network) отдельным окном
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // хоткей-тоггл DevTools (на случай, если закрыл): Cmd/Ctrl+Shift+I
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.key.toLowerCase() === 'i' && (input.meta || input.control) && input.shift) {
      win?.webContents.toggleDevTools()
    }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
