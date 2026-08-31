import type { Editor } from '@tiptap/react'

export interface CaretClientRect {
  top: number
  left: number
  height: number
  fontSize: string
  fontWeight: string
}

function getCaretTypography(editor: Editor): { fontSize: string; fontWeight: string } {
  const { view } = editor
  const { from } = view.state.selection

  try {
    const dom = view.domAtPos(from)
    const el =
      dom.node.nodeType === Node.TEXT_NODE
        ? dom.node.parentElement
        : dom.node instanceof HTMLElement
          ? dom.node
          : null
    if (el) {
      const style = window.getComputedStyle(el)
      return { fontSize: style.fontSize, fontWeight: style.fontWeight }
    }
  } catch {
    // keep defaults
  }

  return { fontSize: '', fontWeight: '' }
}

export function getCaretClientRect(editor: Editor): CaretClientRect {
  const { view } = editor
  const { from } = view.state.selection

  const coords = view.coordsAtPos(from)
  let top = coords.top
  let left = coords.left
  let height = Math.max(coords.bottom - coords.top, 1)

  try {
    const dom = view.domAtPos(from)
    if (dom.node.nodeType === Node.TEXT_NODE) {
      const textNode = dom.node as Text
      const offset = Math.min(dom.offset, textNode.data.length)
      const range = document.createRange()
      range.setStart(textNode, offset)
      range.collapse(true)
      const rect = range.getBoundingClientRect()

      if (Number.isFinite(rect.left)) {
        left = rect.left
      }
      if (rect.height > 0) {
        top = rect.top
        height = rect.height
      } else if (rect.top > 0) {
        top = rect.top
      }
    }
  } catch {
    // keep ProseMirror coords
  }

  const { fontSize, fontWeight } = getCaretTypography(editor)
  return { top, left, height, fontSize, fontWeight }
}

export function getSurfaceCaretCoords(
  editor: Editor,
  surface: HTMLElement,
  placement: 'inline' | 'popover' = 'popover',
) {
  const rect = getCaretClientRect(editor)
  const surfaceRect = surface.getBoundingClientRect()

  return {
    top:
      placement === 'inline'
        ? rect.top - surfaceRect.top
        : rect.top + rect.height - surfaceRect.top + 4,
    left: rect.left - surfaceRect.left,
    lineHeight: rect.height,
    fontSize: rect.fontSize,
    fontWeight: rect.fontWeight,
  }
}
