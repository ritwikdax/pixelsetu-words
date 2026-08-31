import { WELCOME_PAGE_HTML, WELCOME_PAGE_TITLE } from '../data/welcomePage'
import type { DocumentPage } from '../types'
import { DEFAULT_PAGE_ORIENTATION, normalizePageOrientation } from './pageOrientation'

const STORAGE_KEY = 'pixelsetu-word-pages'

export function createPage(title?: string): DocumentPage {
  const now = Date.now()
  const id = crypto.randomUUID()
  return {
    id,
    title: title ?? `untitled-${id.slice(0, 6)}`,
    content: '',
    createdAt: now,
    updatedAt: now,
    orientation: DEFAULT_PAGE_ORIENTATION,
  }
}

export function createWelcomePage(): DocumentPage {
  return {
    ...createPage(WELCOME_PAGE_TITLE),
    content: WELCOME_PAGE_HTML,
  }
}

export function loadPages(): DocumentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DocumentPage[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((page) => ({
          ...page,
          createdAt: page.createdAt ?? page.updatedAt,
          orientation: normalizePageOrientation(page.orientation),
          locked: Boolean(page.locked),
        }))
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return [createWelcomePage()]
}

export function savePages(pages: DocumentPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages))
}
