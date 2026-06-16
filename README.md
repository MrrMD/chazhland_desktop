# chazhland-desktop

Десктоп-клиент мессенджера **chazhland** (Windows-first, Electron). Аналог Discord для своей тусовки.

## Стек

`React 19 + TypeScript + Vite` в оболочке **Electron** (frameless, кастомный titlebar). Тема light/dark + акцент — по hi-fi дизайну (`docs/design/*.dc.html`). Реалтайм — STOMP-over-WebSocket (`@stomp/stompjs`), голос/экран — LiveKit (позже).

## Запуск

```bash
npm install
npm run dev        # vite + автозапуск Electron-окна
```

Прочие команды: `npm run typecheck`, `npm run build` (renderer + electron-бандл), `npm run preview`.

## Конфигурация (env, 12-factor)

Скопируй `.env.example` → `.env`:

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `VITE_API_BASE` | базовый URL REST-бэка | `http://localhost:8080` |
| `VITE_WS_URL` | STOMP-эндпоинт | `<api>/ws` (ws://) |
| `VITE_MOCK` | mock-режим (данные из `src/mocks`) | `true` |

> По умолчанию **`VITE_MOCK=true`** — приложение запускается без живого бэка на мок-данных.
> Для боевого режима: `VITE_MOCK=false` + указать `VITE_API_BASE`/`VITE_WS_URL`.

## Структура

```
electron/        main.ts (frameless окно, IPC), preload.ts (contextBridge)
src/
  theme/         themes.ts (токены light/dark), ThemeProvider.tsx, global.css
  lib/           types.ts (DTO по контракту бэка), config.ts, http.ts, api.ts, ws.ts, livekit.ts
  store/         auth.tsx (сессия, токены, авто-восстановление)
  components/     TitleBar.tsx (Windows-titlebar + тема), Avatar.tsx (presence)
  features/
    auth/        AuthScreen.tsx — вход (одно поле) / регистрация по инвайту
    main/        MainWindow + ChatFeed/Message/Composer/MembersRail/BottomBar/ChannelSwitcher
    admin/       AdminScreen — участники / инвайты / аудит
  mocks/         data.ts — мок-данные
docs/design/     hi-fi референсы из Claude design
docs/DESIGN_BRIEF.md  фичи бэка + список окон
```

## Навигация

Без левой колонки каналов: внизу **контрол-панель** (Сменить канал · профиль со статусом online/idle/dnd · голос: mute/deafen/Go Live/выйти), каналы — через **switcher-модалку** (плитки по типам), участники — справа.

## Статус

✅ Скелет компилируется и запускается. Реализованы экраны auth / главное окно / админка по дизайну, тема light/dark, кастомный titlebar.
⏳ На мок-данных. Дальше: подключить боевой REST/STOMP (`VITE_MOCK=false`), LiveKit-голос/экран, watch-party (плеер по URL — отдельный вид), загрузка вложений (presign), баннер reconnect/оффлайн, трей и нативные уведомления.
