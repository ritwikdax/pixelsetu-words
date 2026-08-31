export interface ExcalidrawScenePayload {
  elements: readonly unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
}

export const EMPTY_EXCALIDRAW_ATTRS = {
  scene: '',
  preview: '',
  configured: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseExcalidrawScene(raw: string): ExcalidrawScenePayload | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!isRecord(parsed)) return null
    const elements = Array.isArray(parsed.elements) ? parsed.elements : []
    const appState = isRecord(parsed.appState) ? parsed.appState : {}
    const files = isRecord(parsed.files) ? parsed.files : {}
    return { elements, appState, files }
  } catch {
    return null
  }
}

export function serializeExcalidrawScene(scene: ExcalidrawScenePayload): string {
  return JSON.stringify({
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files,
  })
}

export function sceneHasVisibleElements(scene: ExcalidrawScenePayload | null): boolean {
  if (!scene) return false
  return scene.elements.some((element) => {
    if (!isRecord(element)) return false
    return element.isDeleted !== true
  })
}

export function pickPersistableAppState(appState: Record<string, unknown>): Record<string, unknown> {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
  }
}
