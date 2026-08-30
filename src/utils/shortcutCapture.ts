import { matchesAppShortcut } from './shortcuts'

/** Block browser defaults only for shortcuts owned by the app. */
export function shouldCaptureShortcut(event: KeyboardEvent): boolean {
  return matchesAppShortcut(event)
}

export function blockBrowserShortcut(event: KeyboardEvent): void {
  if (!shouldCaptureShortcut(event)) return
  event.preventDefault()
}
