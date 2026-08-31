import type { JSONContent } from '@tiptap/core'

export const MIN_TABLE_SIZE = 1
export const MAX_TABLE_SIZE = 12
export const DEFAULT_TABLE_ROWS = 3
export const DEFAULT_TABLE_COLS = 3

export function clampTableSize(value: number, fallback = DEFAULT_TABLE_ROWS): number {
  if (!Number.isInteger(value)) return fallback
  return Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, value))
}

export function stepTableSize(value: number, delta: number): number {
  return clampTableSize(value + delta, value)
}

function emptyCell(type: 'tableHeader' | 'tableCell'): JSONContent {
  return {
    type,
    content: [{ type: 'paragraph' }],
  }
}

export function createTableJSON(rows: number, cols: number): JSONContent {
  const rowCount = clampTableSize(rows, DEFAULT_TABLE_ROWS)
  const colCount = clampTableSize(cols, DEFAULT_TABLE_COLS)
  const header: JSONContent = {
    type: 'tableRow',
    content: Array.from({ length: colCount }, () => emptyCell('tableHeader')),
  }
  const body = Array.from({ length: Math.max(0, rowCount - 1) }, () => ({
    type: 'tableRow',
    content: Array.from({ length: colCount }, () => emptyCell('tableCell')),
  }))
  return { type: 'table', content: [header, ...body] }
}

export function tableDimensions(node: { childCount: number; firstChild?: { childCount: number } | null }): {
  rows: number
  cols: number
} {
  return {
    rows: node.childCount,
    cols: node.firstChild?.childCount ?? 0,
  }
}
