import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalendarBlockView } from './CalendarBlockView'
import { focusCalendarSetupSelect } from '../../utils/focusCalendarSetup'

export function currentCalendarAttrs(configured = false) {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    configured,
  }
}

function parseMonth(value: string | null): number {
  const month = Number(value)
  if (!Number.isInteger(month) || month < 1 || month > 12) return currentCalendarAttrs().month
  return month
}

function parseYear(value: string | null): number {
  const year = Number(value)
  if (!Number.isInteger(year) || year < 1 || year > 9999) return currentCalendarAttrs().year
  return year
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    calendarBlock: {
      insertCalendarBlock: () => ReturnType
    }
  }
}

export const CalendarBlock = Node.create({
  name: 'calendarBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      month: {
        default: 1,
        parseHTML: (element) => parseMonth(element.getAttribute('data-month')),
        renderHTML: (attributes) => ({ 'data-month': String(attributes.month) }),
      },
      year: {
        default: 1970,
        parseHTML: (element) => parseYear(element.getAttribute('data-year')),
        renderHTML: (attributes) => ({ 'data-year': String(attributes.year) }),
      },
      configured: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-configured') === 'true',
        renderHTML: (attributes) => ({
          'data-configured': attributes.configured ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-calendar-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-calendar-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalendarBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('button, [data-calendar-chooser]'))
      },
    })
  },

  addCommands() {
    return {
      insertCalendarBlock:
        () =>
        ({ state, chain, editor }) => {
          const content = [
            { type: this.name, attrs: currentCalendarAttrs(false) },
            { type: 'paragraph' },
          ]
          const { $from } = state.selection
          const parent = $from.parent

          const insert = () => {
            if (parent.isTextblock && parent.content.size === 0) {
              const blockPos = $from.before()
              const blockEnd = blockPos + parent.nodeSize
              return chain()
                .deleteRange({ from: blockPos, to: blockEnd })
                .insertContentAt(blockPos, content)
                .run()
            }

            return chain().insertContent(content).run()
          }

          const inserted = insert()
          if (inserted) {
            queueMicrotask(() => focusCalendarSetupSelect(editor))
          }
          return inserted
        },
    }
  },
})
