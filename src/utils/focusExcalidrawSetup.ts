import type { Editor as TiptapEditor } from '@tiptap/react'

const MAX_ATTEMPTS = 30

export function openLatestExcalidrawEditor(editor: TiptapEditor): void {
  let attempts = 0

  const tryOpen = () => {
    const blocks = editor.view.dom.querySelectorAll<HTMLElement>('.excalidraw-block')
    const block = blocks[blocks.length - 1]
    const button = block?.querySelector<HTMLButtonElement>('.excalidraw-block-open')
    if (button) {
      if (document.activeElement === editor.view.dom) {
        editor.view.dom.blur()
      }
      button.click()
      return
    }
    attempts += 1
    if (attempts < MAX_ATTEMPTS) {
      requestAnimationFrame(tryOpen)
    }
  }

  tryOpen()
}
