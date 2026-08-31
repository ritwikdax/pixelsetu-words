import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findDateTimeTokens } from '../utils/dateTimeTokens'

export const dateTimePreviewPluginKey = new PluginKey('dateTimePreview')

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.type.isCode) return false
    if (!node.isText || !node.text) return
    if (node.marks.some((mark) => mark.type.name === 'code')) return

    const tokens = findDateTimeTokens(node.text)
    for (const token of tokens) {
      const from = pos + token.start
      const to = pos + token.end

      decorations.push(
        Decoration.inline(from, to, {
          class: 'datetime-preview-token',
          'data-datetime-kind': token.kind,
        }),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const DateTimePreview = Extension.create({
  name: 'dateTimePreview',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dateTimePreviewPluginKey,
        state: {
          init: (_, { doc }) => buildDecorations(doc),
          apply: (transaction, decorationSet, _oldState, newState) => {
            if (transaction.docChanged) {
              return buildDecorations(newState.doc)
            }
            return decorationSet.map(transaction.mapping, transaction.doc)
          },
        },
        props: {
          decorations(state) {
            return dateTimePreviewPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})
