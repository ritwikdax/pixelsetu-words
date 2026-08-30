import { useEffect, useRef, useState } from 'react'

interface TerminalInputLineProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: () => void
  focused: boolean
}

export function TerminalInputLine({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  onFocus,
  onBlur,
  focused,
}: TerminalInputLineProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [cursorLeft, setCursorLeft] = useState(0)

  useEffect(() => {
    const width = measureRef.current?.offsetWidth ?? 0
    setCursorLeft(width)
  }, [value])

  return (
    <form
      className="terminal-active-line"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <span className="terminal-prompt">
        pixelsetu@word:<span className="terminal-prompt-path">~/notes</span>$
      </span>
      <div className="terminal-input-area">
        <span ref={measureRef} className="terminal-measure" aria-hidden="true">
          {value || '\u00a0'}
        </span>
        <span className="terminal-command-text">{value}</span>
        {focused && (
          <span
            className="terminal-block-cursor"
            style={{ transform: `translateX(${cursorLeft}px)` }}
            aria-hidden="true"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          className="terminal-input-overlay"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal command input"
        />
      </div>
    </form>
  )
}

export function focusTerminalInput(container: HTMLElement | null) {
  const input = container?.querySelector<HTMLInputElement>('.terminal-input-overlay')
  input?.focus()
}
