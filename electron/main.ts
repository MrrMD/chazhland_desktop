import { app, BrowserWindow, ipcMain, shell, desktopCapturer, Tray, Menu, Notification, globalShortcut, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM-сборка (package.json "type":"module") — __dirname недоступен, вычисляем сами
const appDir = path.dirname(fileURLToPath(import.meta.url))

// dist-electron/main.js  и  dist/index.html лежат рядом после сборки
process.env.APP_ROOT = path.join(appDir, '..')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const MAC = process.platform === 'darwin'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let micAccel: string | null = null
let rendererReady = false
let pendingNotifChannel: string | null = null

function showWindow() {
  if (!win) { createWindow(); return }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray() {
  if (tray) return
  const icon = nativeImage.createFromPath(path.join(process.env.APP_ROOT!, 'build', 'tray.png'))
  if (icon.isEmpty()) return // нет иконки — без трея (чтобы не падать)
  tray = new Tray(icon)
  tray.setToolTip('chazhland')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть chazhland', click: showWindow },
    { type: 'separator' },
    { label: 'Выйти', click: () => { isQuitting = true; app.quit() } },
  ]))
  tray.on('click', showWindow)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1340,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    // macOS — нативные «светофоры» (titleBarStyle hidden), сдвинутые под кастомный titlebar;
    // Windows/Linux — полностью frameless со своими кнопками управления
    ...(MAC ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 13, y: 12 } } : { frame: false }),
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

  // закрытие окна — в трей (приложение работает и получает уведомления); реальный выход — через трей.
  // если трея НЕТ (иконка не загрузилась) — close не перехватываем, иначе на Win/Linux приложение не закрыть.
  win.on('close', (e) => { if (!isQuitting && tray) { e.preventDefault(); win?.hide() } })
  // краш рендерера — снимаем глобальный хоткей, иначе он останется висеть в ОС
  win.webContents.on('render-process-gone', () => { if (micAccel) { try { globalShortcut.unregister(micAccel) } catch { /* */ } micAccel = null } })

  // нативные desktop-уведомления; клик — фокус окна + переход в канал (через рендерер)
  ipcMain.handle('notify:show', (_e, p: { title: string; body: string; channelId?: string }) => {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: p.title, body: p.body })
    n.on('click', () => {
      showWindow()
      if (!p.channelId) return
      if (rendererReady) win?.webContents.send('notif:clicked', { channelId: p.channelId })
      else pendingNotifChannel = p.channelId // окно ещё грузится — отправим после did-finish-load
    })
    n.show()
  })
  // бейдж непрочитанного (dock на macOS / Unity на Linux; Windows — no-op)
  ipcMain.on('app:badge', (_e, count: number) => { app.setBadgeCount(typeof count === 'number' && count > 0 ? count : 0) })

  // глобальный хоткей тумблера микрофона (работает и когда окно не в фокусе)
  ipcMain.handle('voice:setMicHotkey', (_e, accel: string | null) => {
    if (micAccel && micAccel !== accel) { try { globalShortcut.unregister(micAccel) } catch { /* */ } micAccel = null }
    if (accel && !globalShortcut.isRegistered(accel)) {
      try { globalShortcut.register(accel, () => win?.webContents.send('voice:toggle-mic')); micAccel = accel }
      catch { micAccel = null /* занят другим приложением — не оставляем «висячее» состояние */ }
    }
    return micAccel
  })

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

  // рендерер готов принимать IPC — отдаём отложенный клик по уведомлению (если был до загрузки)
  win.webContents.on('did-finish-load', () => {
    rendererReady = true
    if (pendingNotifChannel) { win?.webContents.send('notif:clicked', { channelId: pendingNotifChannel }); pendingNotifChannel = null }
  })

  // хоткей-тоггл DevTools (на случай, если закрыл): Cmd/Ctrl+Shift+I
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.key.toLowerCase() === 'i' && (input.meta || input.control) && input.shift) {
      win?.webContents.toggleDevTools()
    }
  })
}

app.whenReady().then(() => { createWindow(); createTray() })

app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => globalShortcut.unregisterAll())

// окно прячется в трей, а не закрывается → window-all-closed обычно не сработает;
// сработает только при реальном выходе (isQuitting) — тогда и выходим (на macOS остаёмся в доке)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); win = null }
})

app.on('activate', () => { showWindow() })
