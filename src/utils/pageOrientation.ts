export type PageOrientation = 'portrait' | 'landscape' | 'fullscreen'

export type PdfOrientation = 'portrait' | 'landscape'

export const DEFAULT_PAGE_ORIENTATION: PageOrientation = 'portrait'

const ORIENTATION_CYCLE: PageOrientation[] = ['portrait', 'landscape', 'fullscreen']

export function normalizePageOrientation(value: unknown): PageOrientation {
  if (value === 'landscape' || value === 'fullscreen') return value
  return 'portrait'
}

export function togglePageOrientation(orientation: PageOrientation): PageOrientation {
  const index = ORIENTATION_CYCLE.indexOf(orientation)
  const nextIndex = index === -1 ? 0 : (index + 1) % ORIENTATION_CYCLE.length
  return ORIENTATION_CYCLE[nextIndex]!
}

export function formatPageOrientation(orientation: PageOrientation): string {
  return orientation
}

export function resolvePdfOrientation(orientation: PageOrientation): PdfOrientation {
  return orientation === 'landscape' ? 'landscape' : 'portrait'
}
