# chazhland-desktop

Десктоп-клиент самостоятельно хостящегося мессенджера **chazhland** — аналог Discord «для своей тусовки»: текстовые каналы, голос, демонстрация экрана, совместный просмотр видео (watch-together) и админка с ролями/правами.

Это **Electron**-приложение (Windows-first, есть сборка под macOS) поверх веб-клиента на **React 19 + TypeScript + Vite**. Реалтайм — STOMP-over-WebSocket, голос и демонстрация экрана — LiveKit (WebRTC), совместный просмотр — WebTorrent (в main-процессе) + внешний плеер mpv для экзотических кодеков.

> Бэкенд (Spring Boot, отдельный репозиторий `chazhland/backend`) и веб-версия живут отдельно. Этот репозиторий — только десктоп-клиент.

---

## 1. Что это

| | |
|---|---|
| **Назначение** | Десктоп-клиент мессенджера chazhland (чат + голос + screen-share + watch-together + админка) |
| **appId** | `ru.chazhland.desktop` |
| **Прод REST API** | `https://api.chazhland.ru` |
| **Прод WebSocket (STOMP)** | `wss://api.chazhland.ru/ws` |
| **Прод LiveKit** | `livekit.chazhland.ru` |
| **Веб-домен (Origin)** | `https://chat.chazhland.ru` |

### Стек

| Компонент | Версия |
|---|---|
| React | 19.0.0 |
| TypeScript | 5.7.2 |
| Vite | 6.0.3 |
| Electron | 33.2.0 (содержит Node 20.18 LTS) |
| vite-plugin-electron | 0.29.0 |
| vite-plugin-electron-renderer | 0.14.6 |
| WebTorrent | 3.0.16 (prod-зависимость, ESM-only) |

TypeScript: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`. Алиас путей: `@/*` → `src/*`.

---

## 2. Быстрый старт

> **Требуется Node 20 LTS.** Electron 33 поставляется с Node 20.18; на машинах с Node 26+ возникают проблемы при сборке/запуске. См. раздел [Главные подводные камни](#8-главные-подводные-камни).

```bash
# 1. клонировать репозиторий
git clone <repo-url>
cd chazhland-desktop

# 2. установить зависимости (именно так, без --omit=optional — это ломает нативные сборки)
npm install

# 3. подготовить окружение
cp .env.example .env      # затем отредактировать (см. раздел 6 «Конфигурация»)

# 4. запустить dev-режим (Vite dev-сервер + автоперезапуск main/preload + окно Electron)
npm run dev
```

По умолчанию приложение стартует в **mock-режиме** (`VITE_MOCK=true`) — на мок-данных из `src/mocks/data.ts`, без обращения к живому бэкенду. Чтобы подключиться к боевому серверу — выставьте `VITE_MOCK=false` и укажите `VITE_API_BASE` / `VITE_WS_URL` (см. раздел 6).

### Прочие npm-скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Vite dev-сервер + авто-ребилд main/preload + окно Electron |
| `npm run build` | `tsc --noEmit && vite build` — type-check + сборка renderer и main/preload |
| `npm run typecheck` | `tsc --noEmit` — только проверка типов |
| `npm run dist:win` | `npm run build` + `electron-builder --win` (Windows ZIP, x64) |
| `npm run dist:mac` | `npm run build` + `electron-builder --mac` (macOS DMG) |
| `npm run icons` | `node scripts/gen-icons.mjs` — генерация иконок |

---

## 3. Сборка под Windows

```bash
npm run dist:win   # build + electron-builder --win → Windows ZIP (x64)
```

Цель сборки — **ZIP-архив, только x64**. Приложение упаковывается в ASAR; нативные модули (`**/*.node`, `node_modules/node-datachannel/**`) распаковываются через `asarUnpack`.

> Windows-сборку **нельзя проверить с macOS** — после каждого изменения, затрагивающего нативную часть (WebTorrent, node-datachannel, mpv), обязателен один прогон собранного Windows-приложения (smoke-test).

Подробности (внешние ресурсы `mpv.exe`/`yt-dlp.exe`, ESM-preload, проверка `npx asar list`, gotcha с webtorrent@3) — см. **[docs/BUILD.md](docs/BUILD.md)**.

---

## 4. Структура проекта

```
electron/
  main.ts            main-процесс: frameless-окно, IPC, трей, нативные уведомления, rewrite Origin
  preload.ts         contextBridge → window.chazh (preload собирается в ESM; на рантайме preload.mjs)
  torrent.ts         WebTorrent-движок: стрим на 127.0.0.1 с токеном, sweep кэша, лимиты
  mpv.ts             внешний плеер mpv: spawn + JSON-IPC по сокету/pipe (MKV/HEVC/экзотика)

src/
  main.tsx           точка входа: createRoot → ThemeProvider > AuthProvider > App
  App.tsx            корневой роутер: TitleBar + ConnectionBanner + AuthScreen|MainWindow + Toaster
  global.d.ts        интерфейс window.chazh (мост preload ↔ renderer)

  store/
    auth.tsx         React Context: сессия (user + token), login/register/logout, refresh на 401

  features/
    auth/AuthScreen.tsx        вход / регистрация / сброс пароля
    main/MainWindow.tsx        контейнер приложения: состояние, маршрутизация, voice/presence
    main/ChatFeed.tsx          виртуализированная лента сообщений, авто-скролл, jump-to-unread
    main/Message.tsx           одно сообщение: автор, реакции, превью-ответ, контекстные действия
    main/Composer.tsx          ввод текста, emoji-пикер, загрузка файлов (drag-drop)
    main/BottomBar.tsx         статус, mic/deaf/live, бейдж непрочитанного, доступ к админке
    main/ChannelSwitcher.tsx   модалка поиска/создания каналов и DM (Cmd+K)
    main/MembersRail.tsx       правый сайдбар: онлайн/офлайн, участники голоса
    main/ScreenSharePane.tsx   просмотр чужого экрана (несколько шар + пикер, fullscreen)
    main/VoiceSettingsModal.tsx устройства аудио, PTT-клавиша, шумодав/эхоподавление
    main/SettingsModal.tsx     профиль, аватар, смена пароля
    main/WatchView.tsx         синхронный плеер: <video> для DIRECT/торрентов, mpv для экзотики
    main/ChatPanel.tsx         вертикальная обёртка чата
    admin/AdminScreen.tsx      админка (вкладки: Members | Roles | Channels | Audit)
    admin/RolesTab.tsx         CRUD ролей, матрица прав, назначение участникам
    admin/ChannelAccessTab.tsx ACL по каналам (allow/deny/neutral)

  lib/
    http.ts          HTTP-клиент: Bearer, single-flight refresh, повтор на 401
    config.ts        env: VITE_API_BASE, VITE_WS_URL, VITE_MOCK
    api.ts           REST-эндпоинты (auth/messages/members/roles/channels/soundboard/audit)
    types.ts         DTO: User, Member, Channel, Message, Role, Permission, WatchState
    ws.ts            STOMP-over-WebSocket (/topic/channel.*, /topic/watch.*, /topic/presence)
    presence.ts      кэш статусов участников и голосовых членов канала
    voice.ts         LiveKit-клиент: mic/deaf, PTT, screen-share, шумодав
    rnnoise.ts       RNNoise (WASM-шумодав) как LiveKit TrackProcessor
    soundboard.ts    общие аудиоклипы: fetch + presign-upload в S3, публикация отдельным треком
    toast.ts         глобальные тосты (ok|error|info)
    sfx.ts           процедурные UI-звуки (Web Audio)
    markdown.tsx     рендер @mentions, #channels, emoji, **bold**, code
    permissions.ts   метаданные прав (подписи, описания, цвета ролей)

  theme/
    ThemeProvider.tsx  Context: тема light/dark, акцент; CSS-переменные в document.root
    themes.ts          токены по темам, палитра акцентов
    global.css         reset, скроллбар, анимации, утилиты

  mocks/
    data.ts          мок-данные (MOCK_USER, MOCK_CHANNELS, MOCK_MESSAGES …) при VITE_MOCK=true
```

---

## 5. Возможности

| Область | Описание |
|---|---|
| **Чат** | Сообщения с CRUD (правка/удаление), ответы, реакции, группировка по автору, превью вложений, markdown (@mentions, #channels, emoji, **bold**, code). ID сообщений — ULID (сортировка по ID = хронология). |
| **Голос** | LiveKit WebRTC: микрофон, deafen, режимы voice / PTT (по умолчанию `Space`), глобальный хоткей `CommandOrControl+Shift+M`, выбор устройств, авто-gain, эхоподавление, RNNoise-шумодав (клиентский WASM, без серверной лицензии). |
| **Демонстрация экрана** | Несколько одновременных шар с пикером, пресеты качества (`source` / `q1080` / `q720` / `q360`), системный звук-loopback (только Windows). |
| **Совместный просмотр** | Три типа источника: **DIRECT** (прямой URL → `<video>`), **TORRENT** (magnet/infoHash → WebTorrent в main-процессе → стрим на `127.0.0.1`, для MKV/HEVC — внешний mpv), **LINK** (страница, отложено). Синхронизация play/pause/seek через WebSocket. Поиск торрентов через Prowlarr. |
| **Админка / роли** | Вкладки Members / Roles / Channels / Audit: кик участников, CRUD кастомных ролей с иерархией позиций и матрицей прав, ACL по каналам (allow/deny/neutral). Доступна только OWNER/ADMIN. |
| **Прочее** | Presence (online/idle/dnd/offline + голосовые члены каналов), soundboard (общие аудиоклипы отдельным треком), DM, нативные уведомления и трей (свёртывание в трей), бейдж непрочитанного. |

Подробности по конкретным подсистемам — см. раздел [7. Документация](#7-документация).

---

## 6. Конфигурация

Все настройки клиента задаются через переменные окружения `VITE_*` (читаются в `src/lib/config.ts`). Скопируйте `.env.example` → `.env` и при необходимости переопределите.

| Переменная | Назначение | По умолчанию | Прод-значение |
|---|---|---|---|
| `VITE_API_BASE` | Базовый URL REST-бэка | `http://localhost:8080` | `https://api.chazhland.ru` |
| `VITE_WS_URL` | STOMP WebSocket-эндпоинт | автовывод как `ws://localhost:8080/ws` | `wss://api.chazhland.ru/ws` |
| `VITE_MOCK` | Mock-режим (данные из `src/mocks/data.ts`, WS — no-op) | `true` | `false` |

### Пример `.env`

```env
# По умолчанию — mock-режим: приложение работает без живого бэкенда.
VITE_MOCK=true

# Боевое подключение (раскомментируйте и выставьте VITE_MOCK=false):
# VITE_MOCK=false
# VITE_API_BASE=https://api.chazhland.ru
# VITE_WS_URL=wss://api.chazhland.ru/ws
```

> В mock-режиме (`VITE_MOCK=true`, по умолчанию) сетевых запросов нет: все `api.*` возвращают мок-данные, `ws.connect` — no-op. Это даёт быструю итерацию по UI без бэкенда. Для боевого режима выставьте `VITE_MOCK=false`.

Прочие детали контракта (авторизация Bearer, single-flight refresh, ключ `chazh.refresh` в localStorage, заголовок Origin) — см. [docs/BACKEND-CONTRACT.md](docs/BACKEND-CONTRACT.md).

---

## 7. Документация

| Документ | О чём |
|---|---|
| [README.md](README.md) | Этот файл — точка входа, обзор, быстрый старт |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура: Electron (main/preload) ↔ renderer (features → lib → бэк), мост `window.chazh`, IPC |
| [docs/BUILD.md](docs/BUILD.md) | Сборка и упаковка: dev/prod, electron-builder, ASAR, Windows-нюансы |
| [docs/WATCH-TOGETHER.md](docs/WATCH-TOGETHER.md) | Совместный просмотр: WebTorrent-движок, mpv, синхронизация, поиск через Prowlarr + SOCKS5-туннель |
| [docs/VOICE.md](docs/VOICE.md) | Голос/демонстрация экрана: LiveKit, PTT, RNNoise, soundboard, screen-share |
| [docs/BACKEND-CONTRACT.md](docs/BACKEND-CONTRACT.md) | Контракт бэка: REST-эндпоинты, STOMP-топики, DTO, авторизация |

---

## 8. Главные подводные камни

- **Node 20 LTS обязателен.** Electron 33 поставляется с Node 20.18; на dev-машинах с Node 26+ возникают проблемы. Не используйте `npm install --omit=optional` — это ломает нативные сборки.
- **mpv нужно установить отдельно.** Бинарника mpv нет в репозитории — поставьте его сами: `brew install mpv` (macOS) или `winget install mpv` (Windows). На рантайме клиент ищет его по `MPV_PATH`, затем `/opt/homebrew/bin/mpv`, `/usr/local/bin/mpv`, `/usr/bin/mpv` (*nix) или `C:\Program Files\mpv\mpv.exe` / `C:\Program Files\mpv.net\mpvnet.exe` (Windows). На macOS GUI-приложения получают усечённый PATH без `/opt/homebrew/bin`, поэтому проверка по этим путям обязательна. Без mpv торренты с MKV/HEVC не воспроизводятся.
- **Поиск торрентов требует прокси.** Прод-VPS в России, РКН режет многие трекеры по TLS SNI. Поиск через Prowlarr ходит к заблокированным трекерам через SOCKS5-туннель на зарубежный VPS (контейнер `socks-tunnel`). Сам торрент качается P2P на клиенте, **не** через туннель. Без настроенного Prowlarr (`PROWLARR_ENABLED=true` + `PROWLARR_API_KEY`) поиск отдаёт 503. Детали — в [docs/WATCH-TOGETHER.md](docs/WATCH-TOGETHER.md).
- **WebTorrent@3 объявляет `engines.node>=22`**, но Electron 33 несёт Node 20.18 — перед релизом обязательно smoke-test `await import('webtorrent')` на реальном рантайме Electron 33. Модуль помечен как external и должен оставаться в `node_modules`, иначе приложение падает с `MODULE_NOT_FOUND` (проверка: `npx asar list`).
- **mock-режим включён по умолчанию** (`VITE_MOCK=true`): приложение работает на мок-данных без бэкенда. Не забудьте `VITE_MOCK=false` для боевого подключения.
- **`window.chazh` есть только в Electron.** Нативные функции (уведомления, хоткеи, торрент, mpv) недоступны в обычном браузере — проверяйте существование `window.chazh`.
