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

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      className="status-lock-icon"
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {locked ? (
        <>
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M5 7V5.2C5 3.43 6.34 2 8 2s3 1.43 3 3.2V7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M5 7V5.2C5 3.43 6.34 2 8 2s3 1.43 3 3.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}

export function StatusBar({
  page,
  orientation,
  pageIndex,
  totalPages,
  terminalOpen,
  savedFlash,
}: StatusBarProps) {
  const locked = Boolean(page.locked)

  return (
    <footer className="status-bar">
      <span className="status-item">{page.title}</span>
      <span className="status-sep">·</span>
      <span
        className={`status-item status-lock${locked ? ' is-locked' : ''}`}
        aria-label={locked ? 'Note is locked' : 'Note is unlocked'}
      >
        <LockIcon locked={locked} />
        {locked ? 'locked' : 'unlocked'}
      </span>
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
