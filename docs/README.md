# chazhland-desktop · документация

Десктоп-клиент chazhland — self-hosted мессенджер в духе Discord (чат, голос, демонстрация экрана, совместный просмотр, админка, ЛС). Стек: **React 19 + TypeScript 5.7 + Vite 6 + Electron 33** (Node 20.18 LTS).

Эта папка — точка входа в техническую документацию проекта. Ниже — карта документов и порядок чтения для нового разработчика.

---

## С чего начать новому разработчику

1. **Подними проект локально.** Установи зависимости «голым» `npm install` (без `--omit=optional` — он ломает нативные сборки) и запусти dev-режим:

   ```bash
   npm install
   npm run dev
   ```

   По умолчанию клиент стартует в **mock-режиме** (`VITE_MOCK=true`): сеть не дёргается, данные берутся из `src/mocks/data.ts`, WebSocket — no-op. Это позволяет разрабатывать UI без бэкенда. Подробности сборки и переменных окружения — в [BUILD.md](BUILD.md).

   > ⚠️ Нужен **Node 20 LTS**. На Node 26+ Electron 33 ловит проблемы (см. [BUILD.md](BUILD.md)).

2. **Разберись в архитектуре.** Прочитай [ARCHITECTURE.md](ARCHITECTURE.md): как устроены слои Electron (main/preload) ↔ Renderer (features → lib → backend), мост `window.chazh`, стор аутентификации, навигация.

3. **Изучи контракт бэкенда.** [BACKEND-CONTRACT.md](BACKEND-CONTRACT.md) описывает REST-эндпоинты, STOMP-топики, аутентификацию (Bearer + single-flight refresh) и переменные окружения (`VITE_API_BASE`, `VITE_WS_URL`, `VITE_MOCK`). Чтобы переключиться на живой бэкенд — `VITE_MOCK=false`.

4. **Углубись в нужную фичу** — голос ([VOICE.md](VOICE.md)) или совместный просмотр ([WATCH-TOGETHER.md](WATCH-TOGETHER.md)) — это самые сложные и нативно-зависимые части (LiveKit, WebTorrent, mpv, SOCKS5-туннель для Prowlarr).

5. **Перед сборкой Windows-инсталлятора** обязательно прогони один упакованный Windows-smoke-run на каждый нативный инкремент (webtorrent / mpv / utp-native) — упаковка непроверяема с macOS. См. раздел gotchas в [BUILD.md](BUILD.md).

---

## Карта документов

| Документ | Статус | О чём |
|----------|--------|-------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | ✅ создан | Слоистая архитектура клиента: Electron main/preload ↔ Renderer (features → lib data-layer → backend), мост `window.chazh`, IPC-каналы, стор `auth`, темизация, паттерны навигации. |
| [BUILD.md](BUILD.md) | ✅ создан | Сборка и стек: версии (React 19 / TS 5.7 / Vite 6 / Electron 33 / Node 20.18), npm-скрипты (`dev`, `build`, `dist:win`, `dist:mac`, `typecheck`, `icons`), упаковка `electron-builder` (ZIP, x64), ASAR/`asarUnpack`, CSP, и критичные грабли (Node 20 LTS, ESM-preload, webtorrent external, mpv отдельно). |
| [WATCH-TOGETHER.md](WATCH-TOGETHER.md) | ✅ создан | Совместный просмотр: три вида источников (`DIRECT` / `TORRENT` / `LINK`), синхронизация через Redis + STOMP `/topic/watch.{channelId}`, клиентский WebTorrent-движок (localhost stream-server), mpv для экзотических кодеков, SSRF-guard и санитайзинг magnet-ссылок, drift-реконсиляция. |
| [VOICE.md](VOICE.md) | ✅ создан | Голос и демонстрация экрана на LiveKit: микрофонные режимы (voice / PTT), voice-activation gate, RNNoise-шумодав (WASM), deafen, выбор устройств, качество демонстрации (source/1080/720/360), system-audio loopback на Windows, soundboard, состояние участников. |
| [BACKEND-CONTRACT.md](BACKEND-CONTRACT.md) | ✅ создан | Контракт бэкенда: переменные окружения, прод-эндпоинты (`api.chazhland.ru`, `wss://api.chazhland.ru/ws`, `livekit.chazhland.ru`), 50+ REST-эндпоинтов, STOMP-топики и destination'ы, аутентификация (Bearer, ротация refresh-токена `chazh.refresh`), ключевые DTO (`WatchState`, `Message`, `Member`, `Channel`, `WatchSource`). |
| [INCREMENT_4_PLAN.md](INCREMENT_4_PLAN.md) | существует | План инкремента №4. |
| [DESIGN_BRIEF.md](DESIGN_BRIEF.md) | существует | Дизайн-бриф: визуальный язык, токены, экраны. Сопутствующие ассеты — в `docs/design/`. |

> Все перечисленные документы созданы и лежат рядом в `docs/`.

---

## Ключевые ориентиры в коде

Для быстрой навигации (полные детали — в профильных документах):

- **Точка входа:** `src/main.tsx` → `ThemeProvider > AuthProvider > App` (`src/App.tsx`).
- **Главный контейнер UI:** `src/features/main/MainWindow.tsx`.
- **Слой данных:** `src/lib/` (`http.ts`, `api.ts`, `ws.ts`, `presence.ts`, `voice.ts`, `config.ts`, `types.ts`).
- **Мост Electron:** интерфейс `window.chazh` в `src/global.d.ts`, реализация в `electron/preload.ts` (preload собирается как **ESM**).
- **Нативные движки (main-процесс):** `electron/torrent.ts` (WebTorrent), `electron/mpv.ts` (внешний mpv), `electron/main.ts`.
- **Совместный просмотр (renderer):** `src/features/main/WatchView.tsx`.
- **Голос (renderer):** `src/lib/voice.ts`, `src/lib/rnnoise.ts`, `src/lib/soundboard.ts`.
- **Инфраструктура поиска раздач живёт в ДРУГОМ репозитории** — бэкенд/деплой `chazhland` (`infra/socks-tunnel/` + контейнер Prowlarr, доступ к UI только через SSH-туннель). В этом desktop-репо её нет. См. [WATCH-TOGETHER.md](WATCH-TOGETHER.md).
