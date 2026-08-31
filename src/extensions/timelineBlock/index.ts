import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { TimelineBlockView } from './TimelineBlockView'
import { defaultTimelineItems, parseTimelineItems } from './timeline'
import { focusTimelineFirstInput } from '../../utils/focusTimelineInput'

export { createTimelineItem, defaultTimelineItems, parseTimelineItems } from './timeline'
export type { TimelineItem } from './timeline'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    timelineBlock: {
      insertTimelineBlock: () => ReturnType
    }
  }
}

export const TimelineBlock = Node.create({
  name: 'timelineBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: defaultTimelineItems(),
        parseHTML: (element) => parseTimelineItems(element.getAttribute('data-items')),
        renderHTML: (attributes) => ({
          'data-items': JSON.stringify(parseTimelineItems(attributes.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-timeline-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-timeline-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimelineBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('textarea, input, button'))
      },
    })
  },

  addCommands() {
    return {
      insertTimelineBlock:
        () =>
        ({ state, chain, editor }) => {
          const content = [
            { type: this.name, attrs: { items: defaultTimelineItems() } },
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
            queueMicrotask(() => focusTimelineFirstInput(editor))
          }
          return inserted
        },
    }
  },
})
