import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentPage } from '../types'
import { promptPrefix, runShellCommand } from '../utils/terminalShell'
import { focusTerminalInput, TerminalInputLine } from './TerminalInputLine'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { trapFocus } from '../utils/a11y'

import { type Theme } from '../data/themes'

interface DevTerminalProps {
  open: boolean
  onClose: () => void
  shortcutsOpen: boolean
  pages: DocumentPage[]
  activePageId: string
  onSelectPage: (id: string) => void
  onCreatePage: (title?: string) => DocumentPage
  onDeletePage: (id: string) => void
  onRenamePage: (id: string, title: string) => void
  getPageContent: (id: string) => string
  theme: Theme
  onSetTheme: (theme: Theme) => void
  onCycleTheme: () => void
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success'
  text: string
}

export function DevTerminal({
  open,
  onClose,
  shortcutsOpen,
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  onRenamePage,
  getPageContent,
  theme,
  onSetTheme,
  onCycleTheme,
}: DevTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', text: 'pixelsetu-word — a tiny shell for your notes. type "help", or just press enter.' },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [inputFocused, setInputFocused] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(open && !shortcutsOpen, terminalRef, { restoreFocus: false })

  const activePage = pages.find((p) => p.id === activePageId)

  const appendLine = useCallback((line: TerminalLine) => {
    setLines((prev) => [...prev, line])
  }, [])

  const findPage = useCallback(
    (query: string) =>
      pages.find(
        (p) =>
          p.id === query ||
          p.id.startsWith(query) ||
          p.title === query ||
          p.title.toLowerCase() === query.toLowerCase(),
      ),
    [pages],
  )

  const executeCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim()
      if (!trimmed) {
        appendLine({ type: 'input', text: `${promptPrefix()} ` })
        return
      }

      appendLine({ type: 'input', text: `${promptPrefix()} ${trimmed}` })
      const nextHistory = [trimmed, ...history.slice(0, 49)]
      setHistory(nextHistory)
      setHistoryIndex(-1)

      await runShellCommand(
        trimmed,
        {
          pages,
          activePage,
          activePageId,
          history: nextHistory,
          theme,
          findPage,
          getPageContent,
          onCreatePage,
          onSelectPage,
          onDeletePage,
          onRenamePage,
          onSetTheme,
          onCycleTheme,
          onClose,
        },
        {
          print: (type, text) => appendLine({ type, text }),
          clear: () => setLines([]),
        },
      )
    },
    [
      activePage,
      activePageId,
      appendLine,
      findPage,
      getPageContent,
      history,
      onClose,
      onCreatePage,
      onCycleTheme,
      onDeletePage,
      onRenamePage,
      onSelectPage,
      onSetTheme,
      pages,
      theme,
    ],
  )

  const handleSubmit = () => {
    executeCommand(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(nextIndex)
        setInput(history[nextIndex])
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setInput(history[nextIndex])
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  useEffect(() => {
    if (!open || shortcutsOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (terminalRef.current) {
        trapFocus(terminalRef.current, event)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, onClose, shortcutsOpen])

  useEffect(() => {
    if (open && !shortcutsOpen) {
      setTimeout(() => {
        focusTerminalInput(bodyRef.current)
        setInputFocused(true)
      }, 300)
    } else {
      setInputFocused(false)
    }
  }, [open, shortcutsOpen])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
  }, [lines, input])

  return (
    <>
      <div
        className={`terminal-backdrop ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`dev-terminal ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Developer terminal"
        ref={terminalRef}
      >
        <div className="terminal-header">
          <div className="terminal-dots">
            <button
              type="button"
              className="dot red"
              onClick={onClose}
              aria-label="Close terminal"
            />
            <span className="dot yellow" aria-hidden="true" />
            <span className="dot green" aria-hidden="true" />
          </div>
          <span className="terminal-title">pixelsetu@word — bash</span>
          <kbd className="terminal-hint" aria-hidden="true">
            Ctrl + `
          </kbd>
        </div>

        <div
          className="terminal-body"
          ref={bodyRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Terminal output"
          onClick={() => {
            focusTerminalInput(bodyRef.current)
            setInputFocused(true)
          }}
        >
          {lines.map((line, i) => (
            <div key={i} className={`terminal-line ${line.type}`}>
              {line.text}
            </div>
          ))}

          <TerminalInputLine
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            focused={inputFocused && open}
          />
        </div>
      </div>
    </>
  )
}
