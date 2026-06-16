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

  // внешние ссылки — в системный браузер; в ОС пробрасываем ТОЛЬКО http(s)
  // (file:/smb:/ms-msdt: и прочие протоколы — не отдаём шеллу)
  const openExternalSafe = (url: string) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url) }
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url)
    return { action: 'deny' }
  })

  // top-level навигация разрешена только внутри собственного контента (dev-сервер или file://dist).
  // при webSecurity:false это единственная преграда уводу привилегированного окна на чужой HTML.
  const isOwnContent = (url: string) =>
    url.startsWith('file://') || (!!VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL))
  win.webContents.on('will-navigate', (e, url) => { if (!isOwnContent(url)) { e.preventDefault(); openExternalSafe(url) } })
  win.webContents.on('will-redirect', (e, url) => { if (!isOwnContent(url)) { e.preventDefault(); openExternalSafe(url) } })

  // Демонстрация экрана (Go Live): getDisplayMedia в Electron требует обработчик (TZ р.6).
  // Базово выдаём первый экран; позже — нативный пикер источника.
  win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] })
      .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
      .catch(() => callback({}))
  })

  // Бэк проверяет Origin при WS-handshake (setAllowedOriginPatterns). В dev origin = http://localhost:5173,
  // которого нет в allowedOrigins → /ws отклоняется. Подменяем Origin на разрешённый frontend-домен.
  // Только TLS (https/wss): cleartext-запрос не должен нести доверенный Origin (защита от downgrade/MITM).
  win.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['https://api.chazhland.ru/*', 'wss://api.chazhland.ru/*'] },
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

  // запуск без `npm run dev` (нет Vite-сервера) → грузим собранную сборку из dist вместо localhost:5173
  win.webContents.on('did-fail-load', (_e, _code, _desc, validatedURL) => {
    if (validatedURL.startsWith('http://localhost')) {
      win?.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
  })

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
