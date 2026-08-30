import type { Editor as TiptapEditor } from '@tiptap/react'

const MAX_ATTEMPTS = 30

function findLatestCurlBlock(
  editor: TiptapEditor,
  configured: boolean,
): HTMLElement | null {
  const selector = configured
    ? '.curl-block[data-configured="true"]'
    : '.curl-block-setup[data-configured="false"]'
  const blocks = editor.view.dom.querySelectorAll<HTMLElement>(selector)
  return blocks[blocks.length - 1] ?? null
}

function activateField(editor: TiptapEditor, field: HTMLElement): void {
  // Do not use editor.commands.blur() — it removeAllRanges() on the next frame
  // and steals caret from the curl textarea after insert.
  if (document.activeElement === editor.view.dom) {
    editor.view.dom.blur()
  }

  field.focus({ preventScroll: true })

  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement
  ) {
    const end = field.value.length
    field.setSelectionRange(end, end)
  }
}

function focusField(
  editor: TiptapEditor,
  configured: boolean,
  selector: string,
): void {
  let attempts = 0

  const attempt = () => {
    if (editor.isDestroyed) return

    attempts += 1
    const block = findLatestCurlBlock(editor, configured)
    const field = block?.querySelector<HTMLElement>(selector) ?? null

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

export function focusElement(editor: TiptapEditor, field: HTMLElement): void {
  let attempts = 0

  const attempt = () => {
    if (editor.isDestroyed) return
    attempts += 1
    activateField(editor, field)
    if (document.activeElement === field) return
    if (attempts < MAX_ATTEMPTS) {
      requestAnimationFrame(attempt)
    }
  }

  requestAnimationFrame(attempt)
}

export function focusCurlSetupInput(editor: TiptapEditor): void {
  focusField(editor, false, '.curl-block-setup-input')
}

export function focusCurlUrlInput(editor: TiptapEditor): void {
  focusField(editor, true, '.curl-block-url')
}
