import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CalendarChooser } from './CalendarChooser'
import { WEEKDAYS, buildMonthGrid, clampMonth, clampYear } from './calendar'
import { focusAfterCalendarBlock } from '../../utils/focusCalendarSetup'
import { focusElement } from '../../utils/focusCurlSetup'

interface CalendarBlockAttrs {
  month: number
  year: number
  configured: boolean
}

export function CalendarBlockView({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const attrs = node.attrs as CalendarBlockAttrs
  const month = clampMonth(Number(attrs.month))
  const year = clampYear(Number(attrs.year))
  const isSetup = !attrs.configured
  const wasSetupRef = useRef(isSetup)
  const monthButtonHostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isSetup) return
    const field = monthButtonHostRef.current?.querySelector<HTMLElement>('.calendar-block-month')
    if (!field) return
    focusElement(editor, field)
  }, [isSetup, editor])

  useLayoutEffect(() => {
    if (wasSetupRef.current && !isSetup) {
      focusAfterCalendarBlock(editor, getPos)
    }
    wasSetupRef.current = isSetup
  }, [isSetup, editor, getPos])

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  const commitCalendar = useCallback(() => {
    updateAttributes({ month, year, configured: true })
  }, [month, year, updateAttributes])

  const handleChange = useCallback(
    (next: { month: number; year: number }) => {
      updateAttributes(next)
    },
    [updateAttributes],
  )

  const chooser = (
    <div ref={monthButtonHostRef}>
      <CalendarChooser
        month={month}
        year={year}
        setup={isSetup}
        autoFocus={isSetup}
        onChange={handleChange}
        onCommit={isSetup ? commitCalendar : undefined}
      />
    </div>
  )

  if (isSetup) {
    return (
      <NodeViewWrapper
        as="div"
        className={`calendar-block calendar-block-setup ${selected ? 'is-selected' : ''}`}
        contentEditable={false}
        data-calendar-block=""
        data-configured="false"
      >
        <p className="calendar-block-setup-label">Month to insert</p>
        {chooser}
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="div"
      className={`calendar-block ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-calendar-block=""
      data-configured="true"
    >
      {chooser}
      <div className="calendar-block-grid" aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label} className="calendar-block-weekday">
            {label}
          </span>
        ))}
        {cells.map((cell, index) => (
          <span
            key={`${cell.inMonth ? 'm' : 'o'}-${cell.day}-${index}`}
            className={[
              'calendar-block-day',
              cell.inMonth ? '' : 'is-outside',
              cell.isToday ? 'is-today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {cell.day}
          </span>
        ))}
      </div>
    </NodeViewWrapper>
  )
}
