import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CurlBlockView } from './CurlBlockView'
import { focusCurlSetupInput } from '../../utils/focusCurlSetup'

export const EMPTY_CURL_ATTRS = {
  method: 'GET',
  url: '',
  headers: '{}',
  body: '',
  configured: false,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    curlBlock: {
      insertCurlBlock: () => ReturnType
    }
  }
}

export const CurlBlock = Node.create({
  name: 'curlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      method: {
        default: 'GET',
        parseHTML: (element) => element.getAttribute('data-method') ?? 'GET',
        renderHTML: (attributes) => ({ 'data-method': attributes.method }),
      },
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') ?? '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
      headers: {
        default: '{}',
        parseHTML: (element) => element.getAttribute('data-headers') ?? '{}',
        renderHTML: (attributes) => ({ 'data-headers': attributes.headers }),
      },
      body: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-body') ?? '',
        renderHTML: (attributes) => ({ 'data-body': attributes.body }),
      },
      configured: {
        default: false,
        parseHTML: (element) => {
          const value = element.getAttribute('data-configured')
          if (value === 'true') return true
          if (value === 'false') return false
          return Boolean(element.getAttribute('data-url'))
        },
        renderHTML: (attributes) => ({
          'data-configured': attributes.configured ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-curl-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-curl-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CurlBlockView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('textarea, input, select, button'))
      },
    })
  },

  addCommands() {
    return {
      insertCurlBlock:
        () =>
        ({ state, chain, editor }) => {
          const content = [{ type: this.name, attrs: EMPTY_CURL_ATTRS }, { type: 'paragraph' }]
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
            queueMicrotask(() => focusCurlSetupInput(editor))
          }
          return inserted
        },
    }
  },
})
