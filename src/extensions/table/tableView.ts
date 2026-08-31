import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TableView } from '@tiptap/extension-table'

function stretchTable(table: HTMLTableElement) {
  table.style.width = '100%'
  table.style.minWidth = '100%'
  table.style.tableLayout = 'fixed'
  table.style.borderCollapse = 'collapse'
}

export class FullWidthTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    this.table.classList.add('editor-table')
    stretchTable(this.table)
  }

  update(node: ProseMirrorNode) {
    const updated = super.update(node)
    if (updated) stretchTable(this.table)
    return updated
  }
}
