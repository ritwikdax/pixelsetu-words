import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { TableSetupView } from './TableSetupView'
import {
  clampTableSize,
  DEFAULT_TABLE_COLS,
  DEFAULT_TABLE_ROWS,
} from './table'
import { focusTableSetupSelect } from '../../utils/focusTableSetup'
import { FullWidthTableView } from './tableView'

export { createTableJSON, tableDimensions } from './table'

function parseSize(value: string | null, fallback: number): number {
  return clampTableSize(Number(value), fallback)
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableSetup: {
      insertTableSetup: () => ReturnType
    }
  }
}

export const EditorTable = Table.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-Shift-ArrowDown': () => this.editor.commands.addRowAfter(),
      'Mod-Shift-ArrowUp': () => this.editor.commands.addRowBefore(),
      'Mod-Shift-ArrowRight': () => this.editor.commands.addColumnAfter(),
      'Mod-Shift-ArrowLeft': () => this.editor.commands.addColumnBefore(),
      'Mod-Shift-Backspace': () => this.editor.commands.deleteRow(),
      'Mod-Shift-Delete': () => this.editor.commands.deleteRow(),
      'Mod-Alt-Backspace': () => this.editor.commands.deleteColumn(),
      'Mod-Alt-Delete': () => this.editor.commands.deleteColumn(),
    }
  },
}).configure({
  resizable: true,
  lastColumnResizable: true,
  cellMinWidth: 48,
  renderWrapper: true,
  View: FullWidthTableView,
  HTMLAttributes: {
    class: 'editor-table',
  },
})

export const EditorTableRow = TableRow
export const EditorTableCell = TableCell.configure({
  HTMLAttributes: {
    class: 'editor-table-cell',
  },
})
export const EditorTableHeader = TableHeader.configure({
  HTMLAttributes: {
    class: 'editor-table-header',
  },
})

export const TableSetup = Node.create({
  name: 'tableSetup',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      rows: {
        default: DEFAULT_TABLE_ROWS,
        parseHTML: (element) => parseSize(element.getAttribute('data-rows'), DEFAULT_TABLE_ROWS),
        renderHTML: (attributes) => ({ 'data-rows': String(attributes.rows) }),
      },
      cols: {
        default: DEFAULT_TABLE_COLS,
        parseHTML: (element) => parseSize(element.getAttribute('data-cols'), DEFAULT_TABLE_COLS),
        renderHTML: (attributes) => ({ 'data-cols': String(attributes.cols) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-table-setup]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-table-setup': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableSetupView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('button, [data-table-chooser]'))
      },
    })
  },

  addCommands() {
    return {
      insertTableSetup:
        () =>
        ({ state, chain, editor }) => {
          const content = [
            {
              type: this.name,
              attrs: { rows: DEFAULT_TABLE_ROWS, cols: DEFAULT_TABLE_COLS },
            },
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
            queueMicrotask(() => focusTableSetupSelect(editor))
          }
          return inserted
        },
    }
  },
})
