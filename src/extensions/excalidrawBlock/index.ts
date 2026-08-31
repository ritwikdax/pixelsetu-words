import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ExcalidrawBlockView } from './ExcalidrawBlockView'
import { EMPTY_EXCALIDRAW_ATTRS } from './scene'
import { openLatestExcalidrawEditor } from '../../utils/focusExcalidrawSetup'

export { EMPTY_EXCALIDRAW_ATTRS }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    excalidrawBlock: {
      insertExcalidrawBlock: () => ReturnType
    }
  }
}

export const ExcalidrawBlock = Node.create({
  name: 'excalidrawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      scene: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-scene') ?? '',
        renderHTML: (attributes) => ({ 'data-scene': attributes.scene || '' }),
      },
      preview: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-preview') ?? '',
        renderHTML: (attributes) => ({ 'data-preview': attributes.preview || '' }),
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
    return [{ tag: 'div[data-excalidraw-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-excalidraw-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('button, .excalidraw-block-open'))
      },
    })
  },

  addCommands() {
    return {
      insertExcalidrawBlock:
        () =>
        ({ state, chain, editor }) => {
          const content = [
            { type: this.name, attrs: { ...EMPTY_EXCALIDRAW_ATTRS } },
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
            queueMicrotask(() => openLatestExcalidrawEditor(editor))
          }
          return inserted
        },
    }
  },
})
