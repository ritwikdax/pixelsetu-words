import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { getCaretClientRect } from '../utils/caretCoords'
import { getInputCaretRect } from '../utils/inputCaret'
import { isSelectionInAgentOutputBlock } from '../utils/agentMention'

interface AnimatedCursorProps {
  editor: Editor
  pageRef: React.RefObject<HTMLDivElement>
  titleInputRef: React.RefObject<HTMLInputElement>
}

interface CursorPosition {
  top: number
  left: number
  height: number
  visible: boolean
}

export function AnimatedCursor({ editor, pageRef, titleInputRef }: AnimatedCursorProps) {
  const [pos, setPos] = useState<CursorPosition>({
    top: 0,
    left: 0,
    height: 24,
    visible: false,
  })
  const rafRef = useRef<number>()

  useEffect(() => {
    const updatePosition = () => {
      const page = pageRef.current
      if (!page) return

      if (isSelectionInAgentOutputBlock(editor.state)) {
        setPos((current) => ({ ...current, visible: false }))
        return
      }

      const pageRect = page.getBoundingClientRect()
      const titleInput = titleInputRef.current

      if (titleInput && document.activeElement === titleInput) {
        const caret = getInputCaretRect(titleInput)
        setPos({
          top: caret.top - pageRect.top,
          left: caret.left - pageRect.left,
          height: caret.height,
          visible: true,
        })
        return
      }

      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement && activeElement.closest('.curl-block')) {
        setPos((current) => ({ ...current, visible: false }))
        return
      }

      if (!editor.isFocused) {
        setPos((current) => ({ ...current, visible: false }))
        return
      }

      const caret = getCaretClientRect(editor)

      setPos({
        top: caret.top - pageRect.top,
        left: caret.left - pageRect.left,
        height: Math.max(caret.height, 16),
        visible: true,
      })
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafRef.current!)
      rafRef.current = requestAnimationFrame(updatePosition)
    }

    editor.on('selectionUpdate', scheduleUpdate)
    editor.on('transaction', scheduleUpdate)
    editor.on('update', scheduleUpdate)
    editor.on('focus', scheduleUpdate)
    editor.on('blur', scheduleUpdate)

    const editorDom = editor.view.dom
    editorDom.addEventListener('keydown', scheduleUpdate)
    editorDom.addEventListener('keyup', scheduleUpdate)
    editorDom.addEventListener('input', scheduleUpdate)
    editorDom.addEventListener('click', scheduleUpdate)

    const titleInput = titleInputRef.current
    const onTitleChange = () => scheduleUpdate()
    titleInput?.addEventListener('focus', onTitleChange)
    titleInput?.addEventListener('blur', onTitleChange)
    titleInput?.addEventListener('input', onTitleChange)
    titleInput?.addEventListener('keyup', onTitleChange)
    titleInput?.addEventListener('click', onTitleChange)
    titleInput?.addEventListener('select', onTitleChange)

    const scrollParent = pageRef.current?.closest('.editor-shell')
    scrollParent?.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true })

    const page = pageRef.current
    const onSurfaceFocus = () => scheduleUpdate()
    page?.addEventListener('focusin', onSurfaceFocus, true)
    page?.addEventListener('focusout', onSurfaceFocus, true)

    const onSelectionChange = () => {
      if (editor.isFocused || document.activeElement === titleInputRef.current) {
        scheduleUpdate()
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)

    scheduleUpdate()

    return () => {
      editor.off('selectionUpdate', scheduleUpdate)
      editor.off('transaction', scheduleUpdate)
      editor.off('update', scheduleUpdate)
      editor.off('focus', scheduleUpdate)
      editor.off('blur', scheduleUpdate)
      editorDom.removeEventListener('keydown', scheduleUpdate)
      editorDom.removeEventListener('keyup', scheduleUpdate)
      editorDom.removeEventListener('input', scheduleUpdate)
      editorDom.removeEventListener('click', scheduleUpdate)
      titleInput?.removeEventListener('focus', onTitleChange)
      titleInput?.removeEventListener('blur', onTitleChange)
      titleInput?.removeEventListener('input', onTitleChange)
      titleInput?.removeEventListener('keyup', onTitleChange)
      titleInput?.removeEventListener('click', onTitleChange)
      titleInput?.removeEventListener('select', onTitleChange)
      scrollParent?.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
      page?.removeEventListener('focusin', onSurfaceFocus, true)
      page?.removeEventListener('focusout', onSurfaceFocus, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      cancelAnimationFrame(rafRef.current!)
    }
  }, [editor, pageRef, titleInputRef])

  if (!pos.visible) return null

  return (
    <div
      className="animated-cursor"
      style={{
        transform: `translate(${pos.left}px, ${pos.top}px)`,
        height: pos.height,
      }}
      aria-hidden="true"
    />
  )
}
