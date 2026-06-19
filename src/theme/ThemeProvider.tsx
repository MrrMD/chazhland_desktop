import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { THEMES, THEME_ACCENT, accentTint, type ThemeName } from './themes'

// прежний дефолтный акцент; пикера акцента в UI нет, поэтому такое значение в localStorage означает
// «пользователь явно не выбирал» → используем акцент темы (тёмная = blurple)
const LEGACY_ACCENT = '#e0457b'

interface ThemeCtx {
  theme: ThemeName
  accent: string
  toggleTheme: () => void
  setTheme: (t: ThemeName) => void
  setAccent: (a: string) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const LS_THEME = 'chazh.theme'
const LS_ACCENT = 'chazh.accent'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(
    () => (localStorage.getItem(LS_THEME) as ThemeName) || 'dark',
  )
  const [accent, setAccentState] = useState<string | null>(() => {
    const s = localStorage.getItem(LS_ACCENT)
    return s && s.toLowerCase() !== LEGACY_ACCENT ? s : null // null = «не выбирал» → акцент берём из темы
  })
  const effectiveAccent = accent || THEME_ACCENT[theme]

  useEffect(() => {
    const root = document.documentElement
    const vars = THEMES[theme]
    for (const k in vars) root.style.setProperty(k, vars[k])
    root.style.setProperty('--accent', effectiveAccent)
    root.style.setProperty('--accent-tint', accentTint(effectiveAccent, theme))
    root.style.colorScheme = theme
    localStorage.setItem(LS_THEME, theme)
    if (accent) localStorage.setItem(LS_ACCENT, accent); else localStorage.removeItem(LS_ACCENT)
  }, [theme, accent, effectiveAccent])

  const value: ThemeCtx = {
    theme,
    accent: effectiveAccent,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    setTheme: setThemeState,
    setAccent: setAccentState,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTheme must be used within ThemeProvider')
  return c
}
