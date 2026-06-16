import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { THEMES, DEFAULT_ACCENT, accentTint, type ThemeName } from './themes'

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
  const [accent, setAccentState] = useState<string>(
    () => localStorage.getItem(LS_ACCENT) || DEFAULT_ACCENT,
  )

  useEffect(() => {
    const root = document.documentElement
    const vars = THEMES[theme]
    for (const k in vars) root.style.setProperty(k, vars[k])
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-tint', accentTint(accent, theme))
    root.style.colorScheme = theme
    localStorage.setItem(LS_THEME, theme)
    localStorage.setItem(LS_ACCENT, accent)
  }, [theme, accent])

  const value: ThemeCtx = {
    theme,
    accent,
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
