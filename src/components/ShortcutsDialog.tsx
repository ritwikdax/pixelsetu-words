import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ShortcutKeys } from './ShortcutKeys'
import { SHORTCUT_GROUPS } from '../utils/shortcuts'
import { formatShortcutDisplay } from '../utils/shortcutDisplay'
import { trapFocus } from '../utils/a11y'

interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

interface FlatShortcut {
  id: string
  group: string
  keys: string
  action: string
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [activeIndex, setActiveIndex] = useState(0)

  const items = useMemo<FlatShortcut[]>(
    () =>
      SHORTCUT_GROUPS.flatMap((group) =>
        group.shortcuts.map((shortcut, index) => ({
          id: `${group.title}-${index}-${shortcut.keys}`.replace(/\s+/g, '-').toLowerCase(),
          group: group.title,
          keys: shortcut.keys,
          action: shortcut.action,
        })),
      ),
    [],
  )

  useEffect(() => {
    if (!open) return

    setActiveIndex(0)

    const frame = requestAnimationFrame(() => {
      listRef.current?.focus()
    })

    const previouslyFocused = document.activeElement as HTMLElement | null

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      trapFocus(dialogRef.current, event)
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const activeEl = document.getElementById(items[activeIndex]?.id ?? '')
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, items, open])

  if (!open) return null

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, items.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(items.length - 1)
        break
      case 'Tab':
        if (dialogRef.current) {
          trapFocus(dialogRef.current, event.nativeEvent)
        }
        break
      default:
        break
    }
  }

  let lastGroup = ''

  return (
    <>
      <div className="shortcuts-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
      >
        <header className="shortcuts-header">
          <h2 className="shortcuts-title" id={titleId}>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </header>

        <p id={descriptionId} className="shortcuts-description">
          Use Up and Down arrow keys to move through shortcuts. Press Tab to reach the close
          button. Press Escape to close.
        </p>

        <div
          ref={listRef}
          className="shortcuts-body"
          role="list"
          tabIndex={0}
          aria-label="Keyboard shortcuts"
          onKeyDown={handleListKeyDown}
        >
          {items.map((item, index) => {
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            const active = index === activeIndex
            const displayKeys = formatShortcutDisplay(item.keys)

            return (
              <div key={item.id} className="shortcuts-entry">
                {showGroup && (
                  <p className="shortcuts-group-title" aria-hidden="true">
                    {item.group}
                  </p>
                )}
                <div
                  id={item.id}
                  role="listitem"
                  aria-label={`${item.action}. Shortcut: ${displayKeys}. Category: ${item.group}.`}
                  aria-current={active ? 'true' : undefined}
                  className={`shortcuts-row ${active ? 'active' : ''}`}
                >
                  <span className="shortcuts-action">{item.action}</span>
                  <ShortcutKeys keys={item.keys} className="shortcuts-keys" />
                </div>
              </div>
            )
          })}
        </div>

        <footer className="shortcuts-footer" aria-hidden="true">
          <ShortcutKeys keys="Ctrl + K, Ctrl + S" /> opens this dialog
        </footer>
      </div>
    </>
  )
}
