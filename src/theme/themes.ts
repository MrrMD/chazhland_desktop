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
  dark: {
    '--bg': '#0c0b0a',
    '--win': '#17150f',
    '--surface': '#211e18',
    '--surface-2': '#29251e',
    '--surface-3': '#332e26',
    '--border': '#332e26',
    '--border-2': '#403a30',
    '--text': '#f1ece2',
    '--text-2': '#a8a194',
    '--text-3': '#736d62',
    '--scroll': '#3a352c',
    '--scroll-h': '#4a443a',
    '--shadow': 'rgba(0,0,0,.5)',
    '--green': '#2faa6a',
    '--green-tint': 'rgba(47,170,106,.18)',
    '--blue': '#5b8ce6',
    '--blue-tint': 'rgba(91,140,230,.2)',
    '--danger': '#e0392f',
    '--danger-tint': 'rgba(224,57,47,.18)',
    '--warn': '#e0b43a',
    '--warn-tint': 'rgba(224,180,58,.16)',
    '--idle': '#e0b43a',
    '--accent-press': '#c63468',
  },
}

export const ACCENTS = ['#e0457b', '#5b6cff', '#13b886', '#ff6b4a', '#7c5cff'] as const
export const DEFAULT_ACCENT = ACCENTS[0]

export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export function accentTint(accent: string, theme: ThemeName): string {
  return hexA(accent, theme === 'dark' ? 0.18 : 0.1)
}
