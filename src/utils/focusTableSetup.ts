import type { Editor as TiptapEditor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

const MAX_ATTEMPTS = 30

function findLatestTableSetup(editor: TiptapEditor): HTMLElement | null {
  const blocks = editor.view.dom.querySelectorAll<HTMLElement>('.table-setup[data-table-setup]')
  return blocks[blocks.length - 1] ?? null
}

function activateField(editor: TiptapEditor, field: HTMLElement): void {
  if (document.activeElement === editor.view.dom) {
    editor.view.dom.blur()
  }
  field.focus({ preventScroll: true })
}

export function focusTableSetupSelect(editor: TiptapEditor): void {
  let attempts = 0

  const attempt = () => {
    if (editor.isDestroyed) return

    attempts += 1
    const block = findLatestTableSetup(editor)
    const field = block?.querySelector<HTMLElement>('.table-setup-count') ?? null

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

export function focusTableFirstCell(editor: TiptapEditor, tablePos: number): void {
  if (editor.isDestroyed) return

  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return

  const selection = TextSelection.near(editor.state.doc.resolve(tablePos + 1), 1)
  editor.chain().focus().setTextSelection(selection.from).run()
}
