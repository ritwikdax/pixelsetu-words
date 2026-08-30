import type { Editor as TiptapEditor } from '@tiptap/react'

/** True when the caret is at the very start of the document's first block. */
export function isAtDocumentStart(editor: TiptapEditor): boolean {
  const { selection } = editor.state
  if (!selection.empty) return false

  const { $from } = selection
  if ($from.index(0) !== 0) return false

  return $from.pos === $from.start()
}
