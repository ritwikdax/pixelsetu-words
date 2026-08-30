import type { DocumentPage } from '../types'
import type { PageOrientation } from '../utils/pageOrientation'
import { formatPageOrientation } from '../utils/pageOrientation'
import { formatShortcutHint } from '../utils/shortcutDisplay'

interface StatusBarProps {
  page: DocumentPage
  orientation: PageOrientation
  pageIndex: number
  totalPages: number
  terminalOpen: boolean
  savedFlash?: boolean
}

export function StatusBar({
  page,
  orientation,
  pageIndex,
  totalPages,
  terminalOpen,
  savedFlash,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className="status-item">{page.title}</span>
      <span className="status-sep">·</span>
      <span className="status-item">
        page {pageIndex + 1} of {totalPages}
      </span>
      <span className="status-sep">·</span>
      <span className="status-item">{formatPageOrientation(orientation)}</span>
      {savedFlash && (
        <>
          <span className="status-sep">·</span>
          <span className="status-item status-saved" role="status" aria-live="polite">
            saved
          </span>
        </>
      )}
      <span className="status-spacer" />
      <span className="status-item status-hint" aria-label="Keyboard shortcuts hint">
        {terminalOpen
          ? 'terminal open'
          : `${formatShortcutHint('Ctrl + K, Ctrl + S')} shortcuts · ${formatShortcutHint('Ctrl + `')} terminal`}
      </span>
    </footer>
  )
}
