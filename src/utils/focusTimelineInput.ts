import type { Editor as TiptapEditor } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const MAX_ATTEMPTS = 30

function findLatestTimelineBlock(editor: TiptapEditor): HTMLElement | null {
  const blocks = editor.view.dom.querySelectorAll<HTMLElement>('.timeline-block')
  return blocks[blocks.length - 1] ?? null
}

function activateField(editor: TiptapEditor, field: HTMLElement): void {
  if (document.activeElement === editor.view.dom) {
    editor.view.dom.blur()
  }
  field.focus({ preventScroll: true })
}

export function focusTimelineFirstInput(editor: TiptapEditor): void {
  let attempts = 0

  const attempt = () => {
    if (editor.isDestroyed) return

    attempts += 1
    const block = findLatestTimelineBlock(editor)
    const field = block?.querySelector<HTMLElement>('.timeline-block-time') ?? null

    if (field) {
      activateField(editor, field)
      if (field instanceof HTMLInputElement) {
        field.select()
      }
      if (document.activeElement === field) return
    }

    if (attempts < MAX_ATTEMPTS) {
      requestAnimationFrame(attempt)
    }
  }

  requestAnimationFrame(attempt)
}

export function focusAfterTimelineBlock(
  editor: TiptapEditor,
  getPos: NodeViewProps['getPos'],
): void {
  if (editor.isDestroyed) return
  if (typeof getPos !== 'function') return

  const pos = getPos()
  if (typeof pos !== 'number') return

  const timeline = editor.state.doc.nodeAt(pos)
  if (!timeline || timeline.type.name !== 'timelineBlock') return

  const after = pos + timeline.nodeSize
  const next = editor.state.doc.nodeAt(after)

  if (!next || !next.isTextblock) {
    editor
      .chain()
      .insertContentAt(after, { type: 'paragraph' })
      .focus()
      .setTextSelection(after + 1)
      .run()
    return
  }

  editor.chain().focus().setTextSelection(after + 1).run()
}

export function focusBeforeTimelineBlock(
  editor: TiptapEditor,
  getPos: NodeViewProps['getPos'],
): void {
  if (editor.isDestroyed) return
  if (typeof getPos !== 'function') return

  const pos = getPos()
  if (typeof pos !== 'number') return

  const timeline = editor.state.doc.nodeAt(pos)
  if (!timeline || timeline.type.name !== 'timelineBlock') return
  if (pos === 0) {
    editor.chain().focus().setTextSelection(0).run()
    return
  }

  const $before = editor.state.doc.resolve(pos)
  const prev = $before.nodeBefore
  if (prev?.isTextblock) {
    editor.chain().focus().setTextSelection(pos - 1).run()
    return
  }

  editor.chain().focus().setTextSelection(Math.max(0, pos - 1)).run()
}
