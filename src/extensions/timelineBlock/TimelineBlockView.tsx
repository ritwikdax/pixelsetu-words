import { useCallback, useLayoutEffect, useRef } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  focusAfterTimelineBlock,
  focusBeforeTimelineBlock,
} from '../../utils/focusTimelineInput'
import { createTimelineItem, parseTimelineItems, type TimelineItem } from './timeline'

interface TimelineBlockAttrs {
  items: TimelineItem[]
}

type TimelineField = 'time' | 'title' | 'subtext'
type CaretEdge = 'start' | 'end'

const FIELDS: TimelineField[] = ['time', 'title', 'subtext']

function resizeSubtext(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, 22)}px`
}

function fieldSelector(field: TimelineField): string {
  if (field === 'time') return '.timeline-block-time'
  if (field === 'title') return '.timeline-block-title'
  return '.timeline-block-subtext'
}

function isCaretAtStart(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  return el.selectionStart === 0 && el.selectionEnd === 0
}

function isCaretAtEnd(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  return el.selectionStart === el.value.length && el.selectionEnd === el.value.length
}

function isOnFirstLine(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement) return true
  const start = el.selectionStart ?? 0
  return !el.value.slice(0, start).includes('\n')
}

function isOnLastLine(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement) return true
  const start = el.selectionStart ?? 0
  return !el.value.slice(start).includes('\n')
}

function isEventEmpty(item: TimelineItem): boolean {
  return item.time.trim() === '' && item.title.trim() === '' && item.subtext.trim() === ''
}

export function TimelineBlockView({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const attrs = node.attrs as TimelineBlockAttrs
  const items = parseTimelineItems(attrs.items)
  const subtextRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())

  useLayoutEffect(() => {
    subtextRefs.current.forEach((el) => resizeSubtext(el))
  }, [items])

  const commit = useCallback(
    (next: TimelineItem[]) => {
      updateAttributes({ items: next })
    },
    [updateAttributes],
  )

  const updateItem = useCallback(
    (id: string, patch: Partial<TimelineItem>) => {
      commit(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [commit, items],
  )

  const addItem = useCallback(
    (afterId?: string) => {
      const nextItem = createTimelineItem()
      if (!afterId) {
        commit([...items, nextItem])
        return nextItem.id
      }
      const index = items.findIndex((item) => item.id === afterId)
      if (index < 0) {
        commit([...items, nextItem])
        return nextItem.id
      }
      const next = [...items]
      next.splice(index + 1, 0, nextItem)
      commit(next)
      return nextItem.id
    },
    [commit, items],
  )

  const removeItem = useCallback(
    (id: string): string | null => {
      const index = items.findIndex((item) => item.id === id)
      if (items.length <= 1) {
        const blank = createTimelineItem()
        commit([blank])
        return blank.id
      }
      const neighbor = items[index - 1] ?? items[index + 1]
      commit(items.filter((item) => item.id !== id))
      return neighbor?.id ?? null
    },
    [commit, items],
  )

  const focusField = useCallback((id: string, field: TimelineField, edge: CaretEdge = 'start') => {
    const selector = fieldSelector(field)
    let attempts = 0
    const attempt = () => {
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
      const root = document.querySelector(`[data-timeline-item="${escaped}"]`)
      const target = root?.querySelector<HTMLElement>(selector)
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        target.focus()
        const pos = edge === 'end' ? target.value.length : 0
        target.setSelectionRange(pos, pos)
        return
      }
      attempts += 1
      if (attempts < 20) requestAnimationFrame(attempt)
    }
    requestAnimationFrame(attempt)
  }, [])

  const leaveAfter = useCallback(() => {
    focusAfterTimelineBlock(editor, getPos)
  }, [editor, getPos])

  const leaveBefore = useCallback(() => {
    focusBeforeTimelineBlock(editor, getPos)
  }, [editor, getPos])

  const moveField = useCallback(
    (id: string, field: TimelineField, delta: 1 | -1) => {
      const itemIndex = items.findIndex((item) => item.id === id)
      if (itemIndex < 0) return
      const fieldIndex = FIELDS.indexOf(field)
      const nextFieldIndex = fieldIndex + delta

      if (nextFieldIndex >= 0 && nextFieldIndex < FIELDS.length) {
        focusField(id, FIELDS[nextFieldIndex]!, delta === 1 ? 'start' : 'end')
        return
      }

      const nextItem = items[itemIndex + delta]
      if (nextItem) {
        focusField(nextItem.id, delta === 1 ? 'time' : 'subtext', delta === 1 ? 'start' : 'end')
        return
      }

      if (delta === 1) leaveAfter()
      else leaveBefore()
    },
    [focusField, items, leaveAfter, leaveBefore],
  )

  const handleFieldKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
      id: string,
      field: TimelineField,
    ) => {
      const el = event.currentTarget
      const item = items.find((entry) => entry.id === id)
      if (!item) return

      if (event.key === 'Escape') {
        event.preventDefault()
        leaveAfter()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        moveField(id, field, event.shiftKey ? -1 : 1)
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (field === 'time') {
          focusField(id, 'title', 'start')
          return
        }
        const createdId = addItem(id)
        focusField(createdId, 'title', 'start')
        return
      }

      if (event.key === 'ArrowDown' && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (!isOnLastLine(el)) return
        event.preventDefault()
        moveField(id, field, 1)
        return
      }

      if (event.key === 'ArrowUp' && !event.altKey && !event.metaKey && !event.ctrlKey) {
        if (!isOnFirstLine(el)) return
        event.preventDefault()
        moveField(id, field, -1)
        return
      }

      if (event.key === 'Delete' && el.selectionStart === el.selectionEnd && isCaretAtEnd(el)) {
        event.preventDefault()
        const neighborId = removeItem(id)
        if (neighborId) focusField(neighborId, 'title', 'end')
        return
      }

      if (event.key === 'Backspace' && isCaretAtStart(el) && isEventEmpty(item) && items.length > 1) {
        event.preventDefault()
        const neighborId = removeItem(id)
        if (neighborId) focusField(neighborId, 'title', 'end')
      }
    },
    [addItem, focusField, items, leaveAfter, moveField, removeItem],
  )

  return (
    <NodeViewWrapper
      as="div"
      className={`timeline-block ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-timeline-block=""
    >
      <div className="timeline-block-list">
        {items.map((item) => (
          <div key={item.id} className="timeline-block-item" data-timeline-item={item.id}>
            <div className="timeline-block-rail" aria-hidden="true">
              <span className="timeline-block-dot" />
            </div>
            <div className="timeline-block-body">
              <input
                className="timeline-block-time"
                value={item.time}
                placeholder="Time"
                aria-label="Time"
                onChange={(event) => updateItem(item.id, { time: event.target.value })}
                onKeyDown={(event) => handleFieldKeyDown(event, item.id, 'time')}
              />
              <input
                className="timeline-block-title"
                value={item.title}
                placeholder="Title"
                aria-label="Title"
                onChange={(event) => updateItem(item.id, { title: event.target.value })}
                onKeyDown={(event) => handleFieldKeyDown(event, item.id, 'title')}
              />
              <textarea
                ref={(el) => {
                  if (el) subtextRefs.current.set(item.id, el)
                  else subtextRefs.current.delete(item.id)
                  resizeSubtext(el)
                }}
                className="timeline-block-subtext"
                value={item.subtext}
                placeholder="Subtext"
                aria-label="Subtext"
                rows={1}
                onChange={(event) => {
                  resizeSubtext(event.currentTarget)
                  updateItem(item.id, { subtext: event.target.value })
                }}
                onKeyDown={(event) => handleFieldKeyDown(event, item.id, 'subtext')}
              />
              <button
                type="button"
                className="timeline-block-remove"
                aria-label="Remove event"
                tabIndex={-1}
                onClick={() => removeItem(item.id)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="timeline-block-add"
        tabIndex={-1}
        onClick={() => {
          const createdId = addItem()
          focusField(createdId, 'time', 'start')
        }}
      >
        Add event
      </button>
    </NodeViewWrapper>
  )
}
