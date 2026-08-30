import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findColorTokens } from '../utils/cssColors'

export const colorPreviewPluginKey = new PluginKey('colorPreview')

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const tokens = findColorTokens(node.text)
    for (const token of tokens) {
      const from = pos + token.start
      const to = pos + token.end

      decorations.push(
        Decoration.inline(from, to, {
          class: 'color-preview-token',
          style: `--color-preview: ${token.css}`,
          'data-color': token.text,
        }),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const ColorPreview = Extension.create({
  name: 'colorPreview',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: colorPreviewPluginKey,
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
            return colorPreviewPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})
