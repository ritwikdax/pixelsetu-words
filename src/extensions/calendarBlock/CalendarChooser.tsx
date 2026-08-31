import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  MONTH_LABELS,
  clampMonth,
  clampYear,
  monthFromQuery,
  stepMonth,
  stepYear,
  yearOptions,
} from './calendar'

type ChooserField = 'month' | 'year'

interface CalendarChooserProps {
  month: number
  year: number
  setup: boolean
  autoFocus?: boolean
  onChange: (next: { month: number; year: number }) => void
  onCommit?: () => void
}

export function CalendarChooser({
  month,
  year,
  setup,
  autoFocus = false,
  onChange,
  onCommit,
}: CalendarChooserProps) {
  const monthButtonRef = useRef<HTMLButtonElement>(null)
  const yearButtonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typeBufferRef = useRef('')
  const typeTimerRef = useRef<number | null>(null)
  const yearDigitsRef = useRef('')
  const [open, setOpen] = useState<ChooserField | null>(null)
  const [highlight, setHighlight] = useState(0)
  const listboxId = useId()

  const years = useMemo(() => yearOptions(year), [year])

  useEffect(() => {
    if (!autoFocus) return
    monthButtonRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!open) return
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (listRef.current?.contains(target)) return
      if (monthButtonRef.current?.contains(target)) return
      if (yearButtonRef.current?.contains(target)) return
      setOpen(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    return () => {
      if (typeTimerRef.current != null) window.clearTimeout(typeTimerRef.current)
    }
  }, [])

  const options = open === 'month' ? MONTH_LABELS.map((_, index) => index + 1) : years

  const focusField = (field: ChooserField) => {
    const target = field === 'month' ? monthButtonRef.current : yearButtonRef.current
    target?.focus()
  }

  const openList = (field: ChooserField) => {
    const nextOptions = field === 'month' ? MONTH_LABELS.map((_, index) => index + 1) : yearOptions(year)
    const current = field === 'month' ? month : year
    const index = Math.max(0, nextOptions.indexOf(current))
    setHighlight(index)
    setOpen(field)
  }

  const applyValue = (field: ChooserField, value: number) => {
    if (field === 'month') {
      onChange({ month: clampMonth(value), year })
      return
    }
    onChange({ month, year: clampYear(value) })
  }

  const pickHighlight = () => {
    if (!open) return
    const value = options[highlight]
    if (value == null) return
    applyValue(open, value)
    setOpen(null)
    focusField(open)
  }

  const scheduleTypeReset = () => {
    if (typeTimerRef.current != null) window.clearTimeout(typeTimerRef.current)
    typeTimerRef.current = window.setTimeout(() => {
      typeBufferRef.current = ''
      yearDigitsRef.current = ''
      typeTimerRef.current = null
    }, 800)
  }

  const handleFieldKeyDown = (field: ChooserField, event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    if (event.key === 'Tab') {
      setOpen(null)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(null)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open) {
        pickHighlight()
        return
      }
      onCommit?.()
      return
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      if (open === field) setOpen(null)
      else openList(field)
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setOpen(null)
      focusField('month')
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setOpen(null)
      focusField('year')
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const delta = event.key === 'ArrowUp' ? -1 : 1
      if (open === field) {
        setHighlight((index) => {
          const next = index + delta
          if (next < 0) return options.length - 1
          if (next >= options.length) return 0
          return next
        })
        return
      }
      if (field === 'month') applyValue('month', stepMonth(month, delta))
      else applyValue('year', stepYear(year, delta))
      return
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const delta = event.key === 'PageUp' ? -1 : 1
      applyValue('year', stepYear(year, delta === -1 ? -10 : 10))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      if (field === 'month') applyValue('month', 1)
      else applyValue('year', clampYear(year - 10))
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      if (field === 'month') applyValue('month', 12)
      else applyValue('year', clampYear(year + 10))
      return
    }

    if (field === 'month' && event.key.length === 1 && /[a-z]/i.test(event.key)) {
      event.preventDefault()
      const letter = event.key.toLowerCase()
      const nextBuffer = `${typeBufferRef.current}${letter}`
      let matched = monthFromQuery(nextBuffer, month)
      if (matched == null) {
        typeBufferRef.current = letter
        matched = monthFromQuery(letter, month)
      } else {
        typeBufferRef.current = nextBuffer
      }
      if (matched != null) {
        applyValue('month', matched)
        if (open === 'month') setHighlight(matched - 1)
      }
      scheduleTypeReset()
      return
    }

    if (field === 'year' && event.key.length === 1 && /[0-9]/.test(event.key)) {
      event.preventDefault()
      yearDigitsRef.current = `${yearDigitsRef.current}${event.key}`.slice(-4)
      if (yearDigitsRef.current.length === 4) {
        applyValue('year', Number(yearDigitsRef.current))
        yearDigitsRef.current = ''
      }
      scheduleTypeReset()
    }
  }

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  const list = open ? (
    <div
      ref={listRef}
      className={`calendar-chooser-list calendar-chooser-list-${open}`}
      role="listbox"
      id={listboxId}
      aria-label={open === 'month' ? 'Months' : 'Years'}
      onMouseDown={stopPropagation}
    >
      {options.map((value, index) => {
        const active = index === highlight
        const selected = open === 'month' ? value === month : value === year
        return (
          <button
            key={value}
            type="button"
            role="option"
            className={`calendar-chooser-option ${active ? 'is-active' : ''}`}
            data-active={active ? 'true' : 'false'}
            aria-selected={selected}
            onMouseEnter={() => setHighlight(index)}
            onClick={(event) => {
              event.preventDefault()
              applyValue(open, value)
              setOpen(null)
              focusField(open)
            }}
          >
            {open === 'month' ? MONTH_LABELS[value - 1] : value}
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <div className="calendar-chooser" data-calendar-chooser="">
      <div className="calendar-block-controls">
        <div className="calendar-chooser-field">
          <button
            ref={monthButtonRef}
            type="button"
            className={`calendar-block-month ${open === 'month' ? 'is-open' : ''}`}
            aria-label="Month"
            aria-haspopup="listbox"
            aria-expanded={open === 'month'}
            aria-controls={open === 'month' ? listboxId : undefined}
            onMouseDown={stopPropagation}
            onClick={(event) => {
              event.preventDefault()
              if (open === 'month') setOpen(null)
              else openList('month')
            }}
            onKeyDown={(event) => handleFieldKeyDown('month', event)}
          >
            {MONTH_LABELS[month - 1]}
          </button>
          {open === 'month' ? list : null}
        </div>
        <div className="calendar-chooser-field">
          <button
            ref={yearButtonRef}
            type="button"
            className={`calendar-block-year ${open === 'year' ? 'is-open' : ''}`}
            aria-label="Year"
            aria-haspopup="listbox"
            aria-expanded={open === 'year'}
            aria-controls={open === 'year' ? listboxId : undefined}
            onMouseDown={stopPropagation}
            onClick={(event) => {
              event.preventDefault()
              if (open === 'year') setOpen(null)
              else openList('year')
            }}
            onKeyDown={(event) => handleFieldKeyDown('year', event)}
          >
            {year}
          </button>
          {open === 'year' ? list : null}
        </div>
      </div>
      {setup && !open ? (
        <p className="calendar-block-setup-hint">↑↓ change · ←→ month/year · Enter insert</p>
      ) : null}
    </div>
  )
}
