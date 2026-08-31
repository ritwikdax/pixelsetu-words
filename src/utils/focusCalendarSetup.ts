import type { Editor as TiptapEditor } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const MAX_ATTEMPTS = 30

function findLatestCalendarSetup(editor: TiptapEditor): HTMLElement | null {
  const blocks = editor.view.dom.querySelectorAll<HTMLElement>(
    '.calendar-block-setup[data-configured="false"]',
  )
  return blocks[blocks.length - 1] ?? null
}

function activateField(editor: TiptapEditor, field: HTMLElement): void {
  if (document.activeElement === editor.view.dom) {
    editor.view.dom.blur()
  }
  field.focus({ preventScroll: true })
}

export function focusCalendarSetupSelect(editor: TiptapEditor): void {
  let attempts = 0

  const attempt = () => {
    if (editor.isDestroyed) return

    attempts += 1
    const block = findLatestCalendarSetup(editor)
    const field = block?.querySelector<HTMLElement>('.calendar-block-month') ?? null

    if (field) {
      activateField(editor, field)
      if (document.activeElement === field) return
    }

    if (attempts < MAX_ATTEMPTS) {
      requestAnimationFrame(attempt)
    }
  }

  requestAnimationFrame(attempt)
}

export function focusAfterCalendarBlock(
  editor: TiptapEditor,
  getPos: NodeViewProps['getPos'],
): void {
  if (editor.isDestroyed) return
  if (typeof getPos !== 'function') return

  const pos = getPos()
  if (typeof pos !== 'number') return

  const calendar = editor.state.doc.nodeAt(pos)
  if (!calendar || calendar.type.name !== 'calendarBlock') return

  const after = pos + calendar.nodeSize
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
