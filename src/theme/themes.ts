// Дизайн-токены перенесены 1:1 из hi-fi макетов (chazhland-*.dc.html).
export type ThemeName = 'light' | 'dark'
export type Vars = Record<string, string>

export const THEMES: Record<ThemeName, Vars> = {
  light: {
    '--bg': '#eceae4',
    '--win': '#f7f5f1',
    '--surface': '#ffffff',
    '--surface-2': '#f3f1ec',
    '--surface-3': '#eceae4',
    '--border': '#e5e1d8',
    '--border-2': '#d9d4c9',
    '--text': '#1d1b19',
    '--text-2': '#6c665e',
    '--text-3': '#9b958b',
    '--scroll': '#cfcabf',
    '--scroll-h': '#b8b2a6',
    '--shadow': 'rgba(40,36,30,.10)',
    '--green': '#2faa6a',
    '--green-tint': 'rgba(47,170,106,.14)',
    '--blue': '#3a78c2',
    '--blue-tint': 'rgba(58,120,194,.14)',
    '--danger': '#e0392f',
    '--danger-tint': 'rgba(224,57,47,.1)',
    '--warn': '#9a6d18',
    '--warn-tint': 'rgba(224,180,58,.16)',
    '--idle': '#e0b43a',
    '--accent-press': '#c63468',
  },
  // Тёмная тема в стиле Discord: серые поверхности + сине-фиолетовый (blurple) акцент.
  dark: {
    '--bg': '#1e1f22',        // самый тёмный фон (за всем)
    '--win': '#313338',       // основная область (чат)
    '--surface': '#2b2d31',   // хром: шапка, рейлы, нижняя панель, панели/модалки
    '--surface-2': '#35373d', // ховер / поля
    '--surface-3': '#3f4248', // приподнятый ховер
    '--border': '#232529',
    '--border-2': '#3a3d44',
    '--text': '#dbdee1',
    '--text-2': '#b5bac1',
    '--text-3': '#949ba4',
    '--scroll': '#1a1b1e',
    '--scroll-h': '#0f1011',
    '--shadow': 'rgba(0,0,0,.55)',
    '--green': '#23a55a',
    '--green-tint': 'rgba(35,165,90,.18)',
    '--blue': '#5865f2',
    '--blue-tint': 'rgba(88,101,242,.2)',
    '--danger': '#da373c',
    '--danger-tint': 'rgba(218,55,60,.16)',
    '--warn': '#f0b232',
    '--warn-tint': 'rgba(240,178,50,.16)',
    '--idle': '#f0b232',
    '--accent-press': '#4752c4',
  },
}

export const ACCENTS = ['#5865f2', '#e0457b', '#5b6cff', '#13b886', '#ff6b4a', '#7c5cff'] as const
export const DEFAULT_ACCENT = ACCENTS[0]
// акцент по теме: тёмная — фирменный Discord-blurple, светлая — прежний тёплый розовый
export const THEME_ACCENT: Record<ThemeName, string> = { light: '#e0457b', dark: '#5865f2' }

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function accentTint(accent: string, theme: ThemeName): string {
  return hexA(accent, theme === 'dark' ? 0.18 : 0.1)
}
