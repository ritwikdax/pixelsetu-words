import { useCallback, useLayoutEffect, useRef } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { TableSizeChooser } from './TableSizeChooser'
import { clampTableSize, DEFAULT_TABLE_COLS, DEFAULT_TABLE_ROWS } from './table'
import { focusElement } from '../../utils/focusCurlSetup'
import { focusTableFirstCell } from '../../utils/focusTableSetup'

interface TableSetupAttrs {
  rows: number
  cols: number
}

export function TableSetupView({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const attrs = node.attrs as TableSetupAttrs
  const rows = clampTableSize(Number(attrs.rows), DEFAULT_TABLE_ROWS)
  const cols = clampTableSize(Number(attrs.cols), DEFAULT_TABLE_COLS)
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const field = hostRef.current?.querySelector<HTMLElement>('.table-setup-count')
    if (!field) return
    focusElement(editor, field)
  }, [editor])

  const commitTable = useCallback(() => {
    if (typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos !== 'number') return

    const size = node.nodeSize
    const inserted = editor
      .chain()
      .deleteRange({ from: pos, to: pos + size })
      .insertTable({ rows, cols, withHeaderRow: true })
      .run()

    if (inserted) {
      queueMicrotask(() => focusTableFirstCell(editor, pos))
    }
  }, [cols, editor, getPos, rows])

  const handleChange = useCallback(
    (next: { rows: number; cols: number }) => {
      updateAttributes(next)
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper
      as="div"
      className={`table-setup ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-table-setup=""
      data-rows={String(rows)}
      data-cols={String(cols)}
    >
      <p className="calendar-block-setup-label">Table size</p>
      <div ref={hostRef}>
        <TableSizeChooser
          rows={rows}
          cols={cols}
          autoFocus
          onChange={handleChange}
          onCommit={commitTable}
        />
      </div>
    </NodeViewWrapper>
  )
}
