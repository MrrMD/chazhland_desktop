# Контракт с бэкендом

Документ описывает, как десктоп-клиент **chazhland-desktop** общается с серверной частью: прод-домены, конфигурацию через env, аутентификацию, REST-эндпоинты, STOMP-канал реального времени и интеграцию с LiveKit.

См. также смежные документы:

- [README.md](../README.md) — обзор и команды запуска проекта.
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура клиента.
- [docs/BUILD.md](./BUILD.md) — сборка и упаковка.
- [docs/WATCH-TOGETHER.md](./WATCH-TOGETHER.md) — совместный просмотр.
- [docs/VOICE.md](./VOICE.md) — голос и демонстрация экрана.

> **Источник истины по DTO — Java-классы бэкенда** (entity / DTO / controller), а не этот документ и не OpenAPI-спека. Здесь зафиксированы пути, форматы и поведение, которые реально использует клиент; конкретные поля ответов всегда сверяйте по коду бэка.

---

## 1. Прод-домены

| Назначение | Прод-адрес |
|---|---|
| REST API | `https://api.chazhland.ru` |
| WebSocket (STOMP) | `wss://api.chazhland.ru/ws` |
| LiveKit (голос / демонстрация экрана) | `livekit.chazhland.ru` |
| Веб-клиент (origin для запросов) | `https://chat.chazhland.ru` |
| Хранилище файлов (MinIO, S3-совместимое) | `https://s3.chazhland.ru` — анонимно-читаемый бакет (как CDN); загрузка через presigned-URL (см. раздел [Загрузка файлов](#загрузка-файлов-presigned-s3)). |

### Подмена заголовка Origin (только Electron)

Главный процесс Electron переписывает заголовок `Origin` для всех запросов к продакшену через хук `onBeforeSendHeaders`:

- для `https://api.chazhland.ru/*` и `wss://api.chazhland.ru/*`
- устанавливается `Origin: https://chat.chazhland.ru`

Это нужно, чтобы бэкенд принимал запросы из десктоп-приложения так же, как из веб-клиента (CORS / проверка origin).

---

## 2. Конфигурация клиента (env)

Конфиг полностью env-driven (12-factor). Читается в [`src/lib/config.ts`](../src/lib/config.ts).

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8080` | Базовый URL REST API. Прод: `https://api.chazhland.ru`. |
| `VITE_WS_URL` | автопроизводное: `API_BASE` с заменой `http`→`ws` + `/ws` (т.е. `ws://localhost:8080/ws`) | URL WebSocket-эндпоинта STOMP. Прод: `wss://api.chazhland.ru/ws`. |
| `VITE_MOCK` | `'true'` | Mock-режим. При `true` данные берутся из `src/mocks`, сеть не используется. Для живого бэка выставить `VITE_MOCK=false`. |

> **Внимание: mock-режим включён по умолчанию.** Если `VITE_MOCK` не равен строке `'false'`, все вызовы `api.*` возвращают мок-данные из `src/mocks/data.ts`, а WebSocket и presence работают как no-op (сеть не задействуется). Чтобы клиент пошёл в живой бэкенд, обязательно `VITE_MOCK=false`.

### Логика вывода `WS_URL`

Если `VITE_WS_URL` не задан, он вычисляется из `VITE_API_BASE`:

```ts
// src/lib/config.ts
export const WS_URL: string =
  (env.VITE_WS_URL as string) || API_BASE.replace(/^http/, 'ws') + '/ws'
```

То есть `https://api.chazhland.ru` → `wss://api.chazhland.ru/ws`.

### Пример `.env` для прода

```dotenv
# .env (живой прод-бэкенд)
VITE_API_BASE=https://api.chazhland.ru
VITE_WS_URL=wss://api.chazhland.ru/ws
VITE_MOCK=false
```

### Пример `.env` по умолчанию (локальная разработка / mock)

```dotenv
# .env (см. .env.example) — по умолчанию работает mock-режим
VITE_API_BASE=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
VITE_MOCK=true
```

Заготовка лежит в [`.env.example`](../.env.example). Без файла `.env` приложение стартует в mock-режиме.

---

## 3. Аутентификация

### Экраны

Экран [`src/features/auth/AuthScreen.tsx`](../src/features/auth/AuthScreen.tsx) реализует три сценария:

- **вход (login)**
- **регистрация (register)** — по email-коду
- **сброс пароля (password-reset)**

Все три экрана выполняют валидацию полей и показывают ошибки от сервера.

Пути этих сценариев (из `src/lib/api.ts`): `POST /auth/login`, `POST /auth/email-code` → `POST /auth/register` (регистрация по коду), `POST /auth/password-reset/request` → `POST /auth/password-reset/confirm`. Полная таблица — в разделе [REST-эндпоинты → Аутентификация](#аутентификация). Источник истины по полям — контроллеры бэка (`com.chazhland.messenger.web`).

### Токены

- Схема — **Bearer**: каждый авторизованный запрос несёт заголовок `Authorization: Bearer {accessToken}`.
- **Access-токен** хранится только в памяти (безопаснее против XSS).
- **Refresh-токен** хранится в `localStorage` под ключом **`chazh.refresh`**.
- Refresh-токены **одноразовые и автоматически ротируются**: при использовании выдаётся новый. Попытка повторного использования старого refresh-токена приводит к отзыву сессии на всех клиентах (reuse-detection).

### Поток обновления токена (401 → refresh)

Реализован в [`src/lib/http.ts`](../src/lib/http.ts) и [`src/store/auth.tsx`](../src/store/auth.tsx):

1. Запрос получает `401`.
2. Клиент вызывает обновление токена:

   ```http
   POST /auth/refresh
   Content-Type: application/json

   { "refreshToken": "<значение chazh.refresh>" }
   ```

3. Полученный новый access-токен сохраняется в памяти, новый refresh-токен — в `localStorage` (`chazh.refresh`), исходный запрос повторяется.
4. При неудаче обновления — сессия очищается (оба токена), WebSocket отключается, пользователь возвращается на экран входа.

**Single-flight refresh:** параллельные `401`-ответы используют **один общий** вызов `/auth/refresh`, а не запускают несколько. Это критично: иначе гонка одноразовых refresh-токенов сработала бы как reuse-detection и убила бы сессию.

---

## 4. REST-эндпоинты

Базовый клиент — [`src/lib/http.ts`](../src/lib/http.ts) (Bearer-авторизация, single-flight refresh, повтор после 401). Прикладные вызовы — [`src/lib/api.ts`](../src/lib/api.ts). В mock-режиме (`VITE_MOCK=true`) все вызовы `api.*` возвращают данные из `src/mocks/data.ts`.

Пути ниже сгруппированы по областям. Все, кроме presigned-PUT в S3, требуют `Authorization: Bearer`.

### Аутентификация

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/auth/login` | Вход (`{ login, password }`) → токены. |
| `POST` | `/auth/email-code` | Шаг 1 регистрации: код на e-mail (`{ email }`). |
| `POST` | `/auth/register` | Шаг 2 регистрации (`{ email, code, username, password }`) → токены. |
| `POST` | `/auth/password-reset/request` | Запрос кода сброса пароля (`{ email }`). |
| `POST` | `/auth/password-reset/confirm` | Подтверждение сброса (`{ email, code, newPassword }`). |
| `POST` | `/auth/refresh` | Обновление токена (тело `{ refreshToken }`). |
| `GET`  | `/users/me` | Текущий пользователь. |

> Пути взяты из `src/lib/api.ts`; конкретные поля сверяйте по контроллерам бэка.

### Каналы

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/channels/{channelId}/watch` | Состояние совместного просмотра (`204 No Content` → `null`, если источник не задан). |
| `GET` | `/channels/{channelId}/watch/search?q=<query>` | Поиск раздач (запрос 2–200 символов, минимум 1 сидер). |
| `POST` | `/channels/{channelId}/watch/source` | Установить источник (`WatchSourceRequest { kind?, url?, infoHash? }`). |
| `DELETE` | `/channels/{channelId}/watch` | Остановить просмотр (`204 No Content`). |
| `GET` | `/channels/{channelId}/messages/search?q=<query>&limit=30` | Поиск сообщений в канале. |
| `GET` | `/channels/{channelId}/pins` | Закреплённые сообщения. |
| `GET` | `/channels/{channelId}/permissions` | Чтение overwrite-прав канала. |
| `PUT` | `/channels/{channelId}/permissions` | Запись overwrite-прав канала. |
| `DELETE` | `/channels/{channelId}/permissions/{targetType}/{targetId}` | Удалить overwrite для роли/участника. |

> Типы каналов: `TEXT`, `VOICE`, `WATCH`, `DM`.

### Сообщения, реакции, закрепления

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/messages/{messageId}/reactions` | Добавить реакцию. |
| `DELETE` | `/messages/{messageId}/reactions?emoji=<encoded>` | Снять реакцию. |
| `PUT` | `/messages/{messageId}/pin` | Закрепить сообщение. |
| `DELETE` | `/messages/{messageId}/pin` | Открепить сообщение. |

**Особенности сообщений:**

- ID сообщений — **ULID** (лексикографически сортируемы = хронологический порядок). Сортировка по одному только ID = сортировка по времени.
- Эндпоинт сообщений возвращает их **newest-first**; клиент переворачивает в хронологический порядок.
- Пагинация — курсорная: `before={id}` (старше), `after={id}` (новее); ответ — `Page<MessageDto>` с `hasMore`. Курсор **исключает** опорное сообщение — при переходе из поиска/пинов опору нужно домерживать отдельно.

### Загрузка файлов (presigned S3)

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/attachments/presign` | Возвращает `{ uploadUrl, objectKey }`. |
| `PUT` | `{uploadUrl}` | Прямой PUT файла в S3 **без заголовков авторизации** (URL уже подписан). |

- Presigned-URL имеют срок жизни (задаётся бэком) — использовать сразу.
- У вложений нет `thumbnailUrl`; превью строится на клиенте из `url` + `width`/`height` (размеры замеряются клиентом перед отправкой).

### Прямые сообщения (DM)

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/dm/{userId}` | Открыть DM-канал. |
| `GET` | `/dm` | Список DM. |

### Роли и права

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/roles` | Список кастомных серверных ролей. |
| `POST` | `/roles` | Создать роль. |
| `PATCH` | `/roles/{roleId}` | Изменить роль. |
| `DELETE` | `/roles/{roleId}` | Удалить роль. |
| `PUT`/`DELETE` | `/roles/{roleId}/members/{userId}` | Назначить / снять роль участнику. |

- Базовые роли участника: `OWNER`, `ADMIN`, `MEMBER`.
- Массив кастомных `roleIds` у участника отдельный от базовой роли.
- Перечень прав (enum): `VIEW_CHANNEL`, `SEND_MESSAGES`, `MANAGE_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_ROLES`, `MANAGE_SERVER`, `KICK_MEMBERS`, `CREATE_INVITE`, `MENTION_EVERYONE`, `CONNECT`, `ADMINISTRATOR`. На бэке хранятся битмаской.

### Участники и soundboard

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/server/members` | Список участников сервера. |
| `DELETE` | `/members/{userId}` | Кик участника. |
| `PATCH` | `/members/{userId}` | Сменить роль участника. |
| `GET` | `/soundboard` | Список серверных аудио-клипов. |
| `POST` | `/soundboard` | Добавить клип. |
| `DELETE` | `/soundboard/{id}` | Удалить клип. |
| `PUT` | `/members/{userId}/soundboard` | Переключить доступ участника к soundboard (тело `{ disabled }`). |

> Клипы soundboard загружаются по той же схеме presigned S3 (PUT по подписанному URL).

### Состояния прочтения

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/read-states` | Текущие состояния прочтения. |
| `PUT` | `/channels/{channelId}/read-state` | Отметить канал прочитанным до сообщения. |
| `POST` | `/read-states/ack-all` | Отметить всё прочитанным. |

### Голос (LiveKit)

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/livekit/token` | Получить JWT для подключения к комнате LiveKit (тело `{ channelId }`). См. раздел [LiveKit](#6-livekit-голос--демонстрация-экрана). |

### Администрирование / аудит

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/admin/audit` | Журнал аудита (`AuditDto[]`). |

Действия аудита: `member.kick`, `member.role-change`, `invite.create`, `invite.revoke`, `user.reset-password`.

---

## 5. STOMP (WebSocket реального времени)

Клиент — [`src/lib/ws.ts`](../src/lib/ws.ts) (STOMP-over-WebSocket). В mock-режиме `ws.connect` — no-op.

### Подключение

- Эндпоинт: `VITE_WS_URL` (прод: `wss://api.chazhland.ru/ws`).
- На STOMP-кадре `CONNECT` передаётся **JWT** (access-токен), т.е. WebSocket аутентифицируется тем же Bearer-токеном, что и REST.
- Heartbeat: 10 секунд in/out. Задержка переподключения — 3 секунды.
- Подписки переживают реконнект (восстанавливаются автоматически).
- Баннер реконнекта показывается только при `wantConnection=true` (скрыт при намеренном отключении, например логауте).

### Топики подписки (server → client)

| Топик | Содержимое |
|---|---|
| `/topic/channel.{channelId}` | `ChatEvent`: сообщения, индикатор печати, реакции. |
| `/topic/watch.{channelId}` | Полный `WatchState` при каждом изменении состояния просмотра. |
| `/topic/presence` | События присутствия: `PRESENCE_UPDATE`, `VOICE_UPDATE`. |

### Назначения публикации (client → server)

| Назначение | Тело / назначение |
|---|---|
| `/app/watch.{channelId}.control` | `WatchControl { action, positionSeconds }` (низколатентные play/pause/seek). |
| `/app/presence.heartbeat` | Опционально `{ status }`. Без `status` просто продлевает онлайн-таймаут, не меняя статус. |
| `/app/channel.{channelId}.typing` | Индикатор печати. |

### Заметки по совместному просмотру через STOMP

- Управление воспроизведением идёт через **публикацию** в `/app/watch.{channelId}.control`, а полное состояние приходит **подпиской** на `/topic/watch.{channelId}`.
- Клиент экстраполирует позицию: `paused ? positionSeconds : positionSeconds + (Date.now() - updatedAt) / 1000`.
- Управление потеряемо: из нескольких быстрых SEEK обрабатывается только последний (очереди нет — это осознанный компромисс в пользу низкой задержки).

### Статусы присутствия

`online`, `idle`, `dnd`, `offline`. Источник истины для онлайн-статуса в UI — presence-стор ([`src/lib/presence.ts`](../src/lib/presence.ts)), а не `Member.status` из первоначальной выборки (тот устаревает; живые обновления приходят дельтами по `/topic/presence`).

---

## 6. LiveKit (голос / демонстрация экрана)

Голос и демонстрация экрана идут не через бэкенд-API напрямую, а через **LiveKit** (WebRTC), куда клиент подключается по JWT, выданному бэком.

Поток:

1. Клиент вызывает REST: `POST /livekit/token` с телом `{ channelId }` (через `api.livekitToken(channelId)`).
2. Бэкенд генерирует JWT для комнаты LiveKit.
3. Клиент ([`src/lib/voice.ts`](../src/lib/voice.ts)) подключается к комнате на хосте `livekit.chazhland.ru` с этим токеном.

Дополнительно:

- Identity участника в комнате = `userId` (из claim JWT). Имена участников берутся из списка участников сервера, а не из имени в LiveKit-токене (оно часто пустое).
- Микрофон и soundboard публикуются как **раздельные** аудио-дорожки; дорожка soundboard носит имя `'soundboard'`.

> Детали голосового стека (RNNoise, PTT, пороги, демонстрация экрана) — см. [docs/VOICE.md](./VOICE.md).

---

## 7. Ключевые DTO

> Поля ниже отражают то, что использует клиент. **Авторитетный контракт — Java-классы бэкенда** (пакеты `com.chazhland.messenger.domain` / `...web.dto` и контроллеры). Сверяйте перед изменениями.

### `WatchState`

| Поле | Тип | Описание |
|---|---|---|
| `url` | string \| null | URL источника (для DIRECT/LINK). |
| `paused` | boolean | Пауза. |
| `positionSeconds` | double | Позиция воспроизведения. |
| `updatedAt` | epoch ms | Время последнего обновления (для экстраполяции). |
| `hostId` | userId | Кто инициировал просмотр. |
| `lastController` | userId | Кто последним управлял. |
| `source` | `WatchSource` \| null | Источник (см. ниже). |

### `WatchSource`

| Поле | Тип | Описание |
|---|---|---|
| `kind` | `WatchSourceKind` | `DIRECT` / `TORRENT` / `LINK`. |
| `url` | string | Для `DIRECT` / `LINK`. |
| `infoHash` | string \| null | Для `TORRENT`. |

`WatchSourceRequest`: `{ kind?, url?, infoHash? }`. Если `kind` опущен, бэк по умолчанию ставит `DIRECT` (legacy-совместимость).

### `WatchControl`

`{ action, positionSeconds }`, где `action` ∈ `PLAY` / `PAUSE` / `SEEK`. Публикуется в `/app/watch.{channelId}.control`. Для управления нужно право `CONNECT`; для чтения состояния достаточно `VIEW`.

### `WatchSearchResult`

`{ title, size, seeders, leechers, magnet, infoHash, indexer }` — элемент ответа `GET /channels/{channelId}/watch/search`.

> Прочие DTO (`User`, `Member`, `Channel`, `Message`, `Attachment`, `Role`, `Permission`, `ChatEvent`, `AuditDto`) описаны в клиентских типах [`src/lib/types.ts`](../src/lib/types.ts); их полные определения сверяйте по entity/DTO бэкенда.

---

## 8. Поведенческие нюансы (gotchas)

- **Mock включён по умолчанию** — без `VITE_MOCK=false` клиент не пойдёт в сеть.
- **`window.chazh` есть только в Electron** — нативные фичи (уведомления, хоткеи, торрент, mpv) недоступны в обычном браузере.
- **Refresh одноразовый** — повторное использование старого refresh-токена отзывает сессию на всех клиентах; поэтому refresh single-flight.
- **ULID-сортировка** — сообщения сортируются по ID = по времени; курсор `before/after` исключает опорное сообщение.
- **Загрузка файлов** — presigned PUT в S3 идёт без auth-заголовков, отдельно от REST-авторизации; URL имеет срок годности.
- **`GET .../watch` возвращает 204** (→ `null`), когда источник просмотра не задан.
- **STOMP CONNECT требует JWT** — тот же access-токен, что и в REST `Authorization`.
