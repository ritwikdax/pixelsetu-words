import { useEffect, useRef } from 'react'
import { blockBrowserShortcut } from '../utils/shortcutCapture'
import { handleAppShortcut, type ShortcutActions } from '../utils/shortcuts'

export function useAppShortcuts(
  actions: ShortcutActions,
  options?: { enabled?: () => boolean },
) {
  const actionsRef = useRef(actions)
  const enabledRef = useRef(options?.enabled ?? (() => true))
  actionsRef.current = actions
  enabledRef.current = options?.enabled ?? (() => true)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current()) return

      if (handleAppShortcut(event, actionsRef.current)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      blockBrowserShortcut(event)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
