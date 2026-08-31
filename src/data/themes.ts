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
  {
    id: 'offwhite',
    label: 'Off White',
    description: 'Warm cream paper, easy on the eyes',
    preview: { bg: '#f3efe6', page: '#faf7f0', accent: '#4a6fa5' },
  },
  {
    id: 'ivory',
    label: 'Ivory',
    description: 'Cooler cream with a terracotta accent',
    preview: { bg: '#f5efe0', page: '#fffbf0', accent: '#c47b3a' },
  },
  {
    id: 'mist',
    label: 'Mist',
    description: 'Pale cool gray, almost white',
    preview: { bg: '#eef1f4', page: '#f7f9fb', accent: '#5b7c99' },
  },
  {
    id: 'fog',
    label: 'Fog',
    description: 'Light gray notebook with slate ink',
    preview: { bg: '#e4e7eb', page: '#eef0f3', accent: '#64748b' },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Mid-tone gray paper, quiet contrast',
    preview: { bg: '#c5cbd4', page: '#d5dae2', accent: '#334155' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Cool charcoal gray, not quite black',
    preview: { bg: '#2a2d32', page: '#34383f', accent: '#94a3b8' },
  },
  {
    id: 'ash',
    label: 'Ash',
    description: 'Warm stone gray for late-night notes',
    preview: { bg: '#252422', page: '#31302c', accent: '#a8a29e' },
  },
  {
    id: 'sand',
    label: 'Sand',
    description: 'Dry dune beige with olive-gold accents',
    preview: { bg: '#e8dcc4', page: '#f3ead8', accent: '#8b6914' },
  },
  {
    id: 'sky',
    label: 'Sky',
    description: 'Pale daylight blue, clear and airy',
    preview: { bg: '#e4eef6', page: '#f4f9fd', accent: '#0284c7' },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Soft lilac paper with violet ink',
    preview: { bg: '#f0ebf6', page: '#faf7fd', accent: '#7c3aed' },
  },
  {
    id: 'solar',
    label: 'Solar',
    description: 'Solarized light: cream base, cyan accent',
    preview: { bg: '#eee8d5', page: '#fdf6e3', accent: '#268bd2' },
  },
  {
    id: 'ink',
    label: 'Ink',
    description: 'High-contrast black on bright paper',
    preview: { bg: '#ececec', page: '#ffffff', accent: '#111111' },
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
