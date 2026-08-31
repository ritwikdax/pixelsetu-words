import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { exportThemedPreview } from './preview'
import {
  parseExcalidrawScene,
  pickPersistableAppState,
  serializeExcalidrawScene,
  sceneHasVisibleElements,
  type ExcalidrawScenePayload,
} from './scene'
import { useExcalidrawThemeMode } from './theme'

interface ExcalidrawEditorProps {
  sceneRaw: string
  onSave: (next: { scene: string; preview: string; configured: boolean }) => void
  onClose: () => void
}

function filesUsedByElements(
  elements: ReturnType<ExcalidrawImperativeAPI['getSceneElements']>,
  files: BinaryFiles,
): BinaryFiles {
  const used = new Set<string>()
  for (const element of elements) {
    if (element.type === 'image' && 'fileId' in element && element.fileId) {
      used.add(element.fileId)
    }
  }
  const next: BinaryFiles = {}
  for (const id of used) {
    const file = files[id]
    if (file) next[id] = file
  }
  return next
}

export function ExcalidrawEditor({ sceneRaw, onSave, onClose }: ExcalidrawEditorProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const mode = useExcalidrawThemeMode()
  const [saving, setSaving] = useState(false)

  const initialData = useMemo((): ExcalidrawInitialDataState => {
    const parsed = parseExcalidrawScene(sceneRaw)
    const appState = { ...(parsed?.appState ?? {}) }
    delete appState.viewBackgroundColor
    return {
      elements: (parsed?.elements ?? []) as ExcalidrawInitialDataState['elements'],
      appState: {
        ...appState,
        theme: mode,
        collaborators: new Map(),
      },
      files: (parsed?.files ?? {}) as BinaryFiles,
    }
  }, [mode, sceneRaw])

  const persist = useCallback(async () => {
    const api = apiRef.current
    if (!api) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const files = filesUsedByElements(elements, api.getFiles())
      const payload: ExcalidrawScenePayload = {
        elements,
        appState: pickPersistableAppState(appState as unknown as Record<string, unknown>),
        files,
      }
      const preview = await exportThemedPreview(elements, files)
      onSave({
        scene: serializeExcalidrawScene(payload),
        preview,
        configured: sceneHasVisibleElements(payload),
      })
    } finally {
      setSaving(false)
      onClose()
    }
  }, [onClose, onSave])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      void persist()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused?.focus()
    }
  }, [persist])

  return createPortal(
    <div
      className="excalidraw-editor-overlay"
      data-excalidraw-theme={mode}
      role="dialog"
      aria-modal="true"
      aria-label="Drawing editor"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="excalidraw-editor-chrome">
        <p className="excalidraw-editor-title">Drawing</p>
        <button
          type="button"
          className="excalidraw-editor-done"
          disabled={saving}
          onClick={() => void persist()}
        >
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
      <div className="excalidraw-editor-canvas">
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api
          }}
          initialData={initialData}
          theme={mode}
          aiEnabled={false}
          autoFocus
          name="Drawing"
          UIOptions={{
            canvasActions: {
              loadScene: true,
              export: false,
              saveToActiveFile: false,
            },
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
