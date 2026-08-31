import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { exportThemedPreview } from './preview'
import { parseExcalidrawScene, sceneHasVisibleElements } from './scene'
import { useExcalidrawThemeMode } from './theme'

const ExcalidrawEditor = lazy(() =>
  import('./ExcalidrawEditor').then((mod) => ({ default: mod.ExcalidrawEditor })),
)

interface ExcalidrawBlockAttrs {
  scene: string
  preview: string
  configured: boolean
}

function previewSrc(preview: string): string | null {
  const trimmed = preview.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`
  }
  return null
}

export function ExcalidrawBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const attrs = node.attrs as ExcalidrawBlockAttrs
  const mode = useExcalidrawThemeMode()
  const [open, setOpen] = useState(false)
  const [themedPreview, setThemedPreview] = useState(attrs.preview)
  const hasDrawing =
    sceneHasVisibleElements(parseExcalidrawScene(attrs.scene)) ||
    Boolean(previewSrc(themedPreview) ?? previewSrc(attrs.preview))
  const src = previewSrc(themedPreview) ?? previewSrc(attrs.preview)

  useEffect(() => {
    setThemedPreview(attrs.preview)
  }, [attrs.preview])

  useEffect(() => {
    const parsed = parseExcalidrawScene(attrs.scene)
    if (!parsed || !sceneHasVisibleElements(parsed)) {
      setThemedPreview('')
      return
    }

    let cancelled = false
    void exportThemedPreview(parsed.elements, parsed.files).then((next) => {
      if (!cancelled && next) setThemedPreview(next)
    })
    return () => {
      cancelled = true
    }
  }, [attrs.scene])

  const handleSave = useCallback(
    (next: { scene: string; preview: string; configured: boolean }) => {
      updateAttributes(next)
      setThemedPreview(next.preview)
    },
    [updateAttributes],
  )

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  return (
    <NodeViewWrapper
      as="div"
      className={`excalidraw-block ${selected ? 'is-selected' : ''} ${hasDrawing ? '' : 'is-empty'}`}
      contentEditable={false}
      data-excalidraw-block=""
      data-excalidraw-theme={mode}
      data-configured={attrs.configured ? 'true' : 'false'}
    >
      <button
        type="button"
        className="excalidraw-block-open"
        aria-label={hasDrawing ? 'Edit drawing' : 'Open drawing editor'}
        onMouseDown={stopPropagation}
        onClick={(event) => {
          stopPropagation(event)
          setOpen(true)
        }}
      >
        {src ? (
          <img className="excalidraw-block-preview" src={src} alt="Drawing" />
        ) : (
          <span className="excalidraw-block-placeholder">Click to draw</span>
        )}
      </button>
      {open ? (
        <Suspense fallback={null}>
          <ExcalidrawEditor
            sceneRaw={attrs.scene}
            onSave={handleSave}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </NodeViewWrapper>
  )
}
