# Вендоренные бинарники mpv для Windows-сборки

electron-builder копирует **содержимое этой папки** в `resources/mpv/` внутри установленного
приложения (`extraResources` в `package.json` → `win`). В рантайме `electron/mpv.ts` ищет их по
`process.resourcesPath/mpv/`.

## Что сюда положить (тестер на Windows, x64)

1. **`mpv.exe`** — портативная сборка mpv для Windows x64.
   Источник: https://sourceforge.net/projects/mpv-player-windows/files/ (build от *shinchiro*),
   либо https://github.com/zhongfly/mpv-winbuild. Распаковать архив, взять `mpv.exe`.
   > Достаточно одного `mpv.exe`; сопутствующие dll из портативной сборки положить рядом, если требуются.

2. **`yt-dlp.exe`** — для LINK-источников (YouTube/VK/Rutube).
   Источник: https://github.com/yt-dlp/yt-dlp/releases/latest → `yt-dlp.exe`.

Итоговая раскладка:

```
resources/mpv/win32-x64/
  ├── mpv.exe
  ├── yt-dlp.exe
  └── README.md   (этот файл)
```

## Локальная разработка (dev, без паковки)

В dev `electron/mpv.ts` ищет бинари в этой же папке (`resources/mpv/<platform>-<arch>/`),
а если не найдёт — берёт системные (`MPV_PATH`/`YTDLP_PATH` env, brew, PATH). На macOS проще
поставить системно: `brew install mpv yt-dlp`.

⚠️ Бинари НЕ коммитятся в git (см. `resources/mpv/.gitignore`) — они большие и платформенные.
Каждый собирающий Windows-релиз кладёт их сюда сам.
