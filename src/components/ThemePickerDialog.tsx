import { useEffect, useId, useRef, useState } from 'react'
import { THEMES, type Theme } from '../data/themes'
import { trapFocus } from '../utils/a11y'

interface ThemePickerDialogProps {
  open: boolean
  theme: Theme
  onSelectTheme: (theme: Theme) => void
  onClose: () => void
}

export function ThemePickerDialog({
  open,
  theme,
  onSelectTheme,
  onClose,
}: ThemePickerDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, THEMES.findIndex((entry) => entry.id === theme)),
  )

  useEffect(() => {
    if (!open) return

    const nextIndex = THEMES.findIndex((entry) => entry.id === theme)
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0)

    const frame = requestAnimationFrame(() => {
      gridRef.current?.focus()
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
  }, [open, onClose, theme])

  useEffect(() => {
    if (!open) return
    const activeEl = document.getElementById(`theme-option-${THEMES[activeIndex]?.id}`)
    activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeIndex, open])

  if (!open) return null

  const columns = 2

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, THEMES.length - 1))
        break
      case 'ArrowLeft':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + columns, THEMES.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - columns, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(THEMES.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onSelectTheme(THEMES[activeIndex].id)
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

  return (
    <>
      <div className="shortcuts-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="theme-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialogRef}
      >
        <header className="shortcuts-header">
          <h2 className="shortcuts-title" id={titleId}>
            Choose Theme
          </h2>
          <button
            type="button"
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Close theme picker"
          >
            ×
          </button>
        </header>

        <p id={descriptionId} className="shortcuts-description">
          Pick a color theme for the editor. Use arrow keys to navigate, Enter to apply, Escape
          to close.
        </p>

        <div
          ref={gridRef}
          className="theme-picker-grid"
          role="listbox"
          aria-label="Color themes"
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
        >
          {THEMES.map((entry, index) => {
            const active = index === activeIndex
            const selected = entry.id === theme

            return (
              <button
                key={entry.id}
                id={`theme-option-${entry.id}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`theme-picker-card ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}
                onClick={() => onSelectTheme(entry.id)}
                onFocus={() => setActiveIndex(index)}
              >
                <span className="theme-picker-preview" aria-hidden="true">
                  <span
                    className="theme-picker-swatch theme-picker-swatch-bg"
                    style={{ background: entry.preview.bg }}
                  />
                  <span
                    className="theme-picker-swatch theme-picker-swatch-page"
                    style={{ background: entry.preview.page }}
                  />
                  <span
                    className="theme-picker-swatch theme-picker-swatch-accent"
                    style={{ background: entry.preview.accent }}
                  />
                </span>
                <span className="theme-picker-label">{entry.label}</span>
                <span className="theme-picker-description">{entry.description}</span>
                {selected && <span className="theme-picker-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>

        <footer className="shortcuts-footer" aria-hidden="true">
          <kbd>Ctrl + K</kbd>, then <kbd>Ctrl + T</kbd> opens this picker
        </footer>
      </div>
    </>
  )
}
