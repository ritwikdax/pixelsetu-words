import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { HttpResultView } from './HttpResultView'

export const HttpResult = Node.create({
  name: 'httpResult',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') ?? '',
        renderHTML: (attributes) => {
          if (!attributes.url) return {}
          return { 'data-url': attributes.url }
        },
      },
      status: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-status') ?? 0),
        renderHTML: () => ({}),
      },
      statusText: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-status-text') ?? '',
        renderHTML: () => ({}),
      },
      contentType: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-content-type') ?? '',
        renderHTML: (attributes) => ({ 'data-content-type': attributes.contentType }),
      },
      body: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-body') ?? '',
        renderHTML: (attributes) => ({ 'data-body': attributes.body }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-http-result]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-http-result': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(HttpResultView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('a'))
      },
    })
  },
})
