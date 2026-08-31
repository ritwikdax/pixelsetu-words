import { EXCALIDRAW_LIGHT_BG } from './theme'

function isVisibleElement(element: unknown): boolean {
  return Boolean(
    element &&
      typeof element === 'object' &&
      !Array.isArray(element) &&
      (element as { isDeleted?: boolean }).isDeleted !== true,
  )
}

export async function exportThemedPreview(
  elements: readonly unknown[],
  files: Record<string, unknown>,
): Promise<string> {
  const visible = elements.filter(isVisibleElement)
  if (visible.length === 0) return ''

  const { exportToSvg } = await import('@excalidraw/excalidraw')
  const svg = await exportToSvg({
    elements: visible as Parameters<typeof exportToSvg>[0]['elements'],
    appState: {
      exportBackground: true,
      viewBackgroundColor: EXCALIDRAW_LIGHT_BG,
      exportWithDarkMode: false,
    },
    files: files as Parameters<typeof exportToSvg>[0]['files'],
  })
  svg.removeAttribute('filter')
  return svg.outerHTML
}
