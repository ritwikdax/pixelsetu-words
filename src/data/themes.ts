export const THEMES = [
  {
    id: 'light',
    label: 'Light',
    description: 'Clean paper white with soft shadows',
    preview: { bg: '#f5f3ef', page: '#ffffff', accent: '#2563eb' },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'GitHub-inspired deep charcoal',
    preview: { bg: '#0d1117', page: '#161b22', accent: '#58a6ff' },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    description: 'Warm parchment for long reading sessions',
    preview: { bg: '#f4ecd8', page: '#faf6eb', accent: '#b45309' },
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Cool arctic blues and soft grays',
    preview: { bg: '#2e3440', page: '#3b4252', accent: '#88c0d0' },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Deep mossy greens under canopy shade',
    preview: { bg: '#1a2419', page: '#243024', accent: '#4ade80' },
  },
  {
    id: 'rose',
    label: 'Rose',
    description: 'Soft blush tones with gentle contrast',
    preview: { bg: '#fdf2f4', page: '#fffafb', accent: '#db2777' },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Rich indigo night with violet accents',
    preview: { bg: '#0f0a1a', page: '#1a1229', accent: '#a78bfa' },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Deep teal dusk with seafoam highlights',
    preview: { bg: '#0b1c22', page: '#12262e', accent: '#2dd4bf' },
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warm charcoal with copper glow',
    preview: { bg: '#1c1410', page: '#271c16', accent: '#f0a46a' },
  },
  {
    id: 'matcha',
    label: 'Matcha',
    description: 'Soft tea-green paper for calm writing',
    preview: { bg: '#eef3e4', page: '#f7faf0', accent: '#4d7c0f' },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Velvet purple night with magenta accents',
    preview: { bg: '#191a2e', page: '#282a36', accent: '#bd93f9' },
  },
] as const

export type Theme = (typeof THEMES)[number]['id']

export const THEME_IDS = THEMES.map((theme) => theme.id) as Theme[]

export const DEFAULT_THEME: Theme = 'light'

export function isTheme(value: string | null | undefined): value is Theme {
  return THEME_IDS.includes(value as Theme)
}

export function getThemeMeta(theme: Theme) {
  return THEMES.find((entry) => entry.id === theme) ?? THEMES[0]
}

export function getNextTheme(theme: Theme): Theme {
  const index = THEME_IDS.indexOf(theme)
  return THEME_IDS[(index + 1) % THEME_IDS.length]
}
