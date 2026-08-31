import type { Editor as TiptapEditor } from '@tiptap/react'

/** Place the caret at the end of the document. */
export function focusAtDocumentEnd(editor: TiptapEditor): boolean {
  if (editor.isDestroyed) return false
  return editor.commands.focus('end')
}

/** True when the caret is at the very start of the document's first block. */
export function isAtDocumentStart(editor: TiptapEditor): boolean {
  const { selection } = editor.state
  if (!selection.empty) return false

  const { $from } = selection
  if ($from.index(0) !== 0) return false

  return $from.pos === $from.start()
}
