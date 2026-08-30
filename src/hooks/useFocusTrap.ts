import { useEffect } from 'react'
import { focusFirstElement, trapFocus } from '../utils/a11y'

export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  options?: { restoreFocus?: boolean },
) {
  const restoreFocus = options?.restoreFocus ?? true

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    requestAnimationFrame(() => focusFirstElement(container))

    const onKeyDown = (event: KeyboardEvent) => {
      if (containerRef.current) {
        trapFocus(containerRef.current, event)
      }
    }

    container.addEventListener('keydown', onKeyDown)

    return () => {
      container.removeEventListener('keydown', onKeyDown)
      if (restoreFocus) previouslyFocused?.focus()
    }
  }, [active, containerRef, restoreFocus])
}
