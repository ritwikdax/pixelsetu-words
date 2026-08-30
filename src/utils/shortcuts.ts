export interface ShortcutActions {
  goToNextPage: () => void
  goToPrevPage: () => void
  goToPage: (index: number) => void
  createPage: () => void
  closePage: () => void
  save: () => void
  editPageTitle: () => void
  togglePageOrientation: () => void
  toggleTerminal: () => void
  openTerminal: () => void
  openShortcutsViewer: () => void
  openThemePicker: () => void
}

function isMod(e: KeyboardEvent) {
  return e.ctrlKey || e.metaKey
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

let chordPending = false
let chordTimer: number | undefined

let pageJumpBuffer = ''
let pageJumpTimer: number | undefined

const PAGE_JUMP_TIMEOUT_MS = 450
const PAGE_JUMP_MAX_DIGITS = 3

function resetChord() {
  chordPending = false
  window.clearTimeout(chordTimer)
}

function startChord() {
  chordPending = true
  window.clearTimeout(chordTimer)
  chordTimer = window.setTimeout(resetChord, 1200)
}

function resetPageJump() {
  pageJumpBuffer = ''
  window.clearTimeout(pageJumpTimer)
  pageJumpTimer = undefined
}

function commitPageJump(actions: ShortcutActions) {
  window.clearTimeout(pageJumpTimer)
  pageJumpTimer = undefined

  if (!pageJumpBuffer) return

  const pageNumber = Number.parseInt(pageJumpBuffer, 10)
  pageJumpBuffer = ''

  if (pageNumber >= 1) {
    actions.goToPage(pageNumber - 1)
  }
}

function schedulePageJump(actions: ShortcutActions) {
  window.clearTimeout(pageJumpTimer)
  pageJumpTimer = window.setTimeout(() => {
    commitPageJump(actions)
  }, PAGE_JUMP_TIMEOUT_MS)
}

function isPageJumpShortcut(e: KeyboardEvent): boolean {
  const mod = isMod(e)
  if (!mod || e.shiftKey || e.altKey) return false
  if (pageJumpBuffer !== '' && /^[0-9]$/.test(e.key)) return true
  return /^[1-9]$/.test(e.key)
}

export function cancelPageJump() {
  resetPageJump()
}

/** True when this key combo is handled by the app (and should not reach the browser). */
export function matchesAppShortcut(e: KeyboardEvent): boolean {
  const mod = isMod(e)
  const inTerminal =
    isTypingTarget(e.target) &&
    (e.target as HTMLElement).classList.contains('terminal-input-overlay')

  if (chordPending && mod && e.key.toLowerCase() === 's') return true
  if (chordPending && mod && e.key.toLowerCase() === 't') return true

  if (inTerminal) {
    return mod && e.key === '`'
  }

  if (mod && e.key.toLowerCase() === 'k') return true
  if (mod && e.key === '`') return true
  if (mod && e.shiftKey && e.key.toLowerCase() === 'p') return true
  if (mod && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey) return true
  if (mod && e.key.toLowerCase() === 'i' && !e.shiftKey && !e.altKey) return true
  if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) return true
  if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey) return true
  if (mod && e.altKey && e.key.toLowerCase() === 't') return true
  if (mod && e.shiftKey && e.key === 'ArrowRight') return true
  if (mod && e.shiftKey && e.key === 'ArrowLeft') return true
  if (mod && e.key === 'PageDown') return true
  if (mod && e.key === 'PageUp') return true
  if (mod && e.key === 'Tab') return true
  if (mod && e.altKey && e.key === 'ArrowDown') return true
  if (mod && e.altKey && e.key === 'ArrowUp') return true
  if (e.altKey && e.key === 'ArrowRight') return true
  if (e.altKey && e.key === 'ArrowLeft') return true
  if (isPageJumpShortcut(e)) return true

  return false
}

export function handleAppShortcut(e: KeyboardEvent, actions: ShortcutActions): boolean {
  const mod = isMod(e)
  const inTerminal =
    isTypingTarget(e.target) &&
    (e.target as HTMLElement).classList.contains('terminal-input-overlay')

  if (chordPending && mod && e.key.toLowerCase() === 's') {
    e.preventDefault()
    resetChord()
    actions.openShortcutsViewer()
    return true
  }

  if (chordPending && mod && e.key.toLowerCase() === 't') {
    e.preventDefault()
    resetChord()
    actions.openThemePicker()
    return true
  }

  if (chordPending && !mod) {
    resetChord()
  }

  if (pageJumpBuffer && !isPageJumpShortcut(e)) {
    commitPageJump(actions)
  }

  if (inTerminal) {
    if (mod && e.key === '`') {
      e.preventDefault()
      actions.toggleTerminal()
      return true
    }
    return false
  }

  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    startChord()
    return true
  }

  if (mod && e.key === '`') {
    e.preventDefault()
    actions.toggleTerminal()
    return true
  }

  if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault()
    actions.openTerminal()
    return true
  }

  if (mod && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey) {
    e.preventDefault()
    actions.save()
    return true
  }

  if (mod && e.key.toLowerCase() === 'i' && !e.shiftKey && !e.altKey) {
    e.preventDefault()
    actions.togglePageOrientation()
    return true
  }

  if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
    e.preventDefault()
    actions.createPage()
    return true
  }

  if (mod && e.key.toLowerCase() === 'w' && !e.shiftKey) {
    e.preventDefault()
    actions.closePage()
    return true
  }

  if (mod && e.altKey && e.key.toLowerCase() === 't') {
    e.preventDefault()
    actions.editPageTitle()
    return true
  }

  if (mod && e.shiftKey && e.key === 'ArrowRight') {
    e.preventDefault()
    actions.goToNextPage()
    return true
  }

  if (mod && e.shiftKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    actions.goToPrevPage()
    return true
  }

  if (mod && e.key === 'PageDown') {
    e.preventDefault()
    actions.goToNextPage()
    return true
  }

  if (mod && e.key === 'PageUp') {
    e.preventDefault()
    actions.goToPrevPage()
    return true
  }

  if (mod && e.key === 'Tab') {
    e.preventDefault()
    if (e.shiftKey) actions.goToPrevPage()
    else actions.goToNextPage()
    return true
  }

  if (mod && e.altKey && e.key === 'ArrowDown') {
    e.preventDefault()
    actions.goToNextPage()
    return true
  }

  if (mod && e.altKey && e.key === 'ArrowUp') {
    e.preventDefault()
    actions.goToPrevPage()
    return true
  }

  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault()
    actions.goToNextPage()
    return true
  }

  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    actions.goToPrevPage()
    return true
  }

  if (isPageJumpShortcut(e)) {
    e.preventDefault()
    pageJumpBuffer += e.key
    if (pageJumpBuffer.length > PAGE_JUMP_MAX_DIGITS) {
      pageJumpBuffer = pageJumpBuffer.slice(-PAGE_JUMP_MAX_DIGITS)
    }
    schedulePageJump(actions)
    return true
  }

  return false
}

export interface ShortcutItem {
  keys: string
  action: string
}

export interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: 'Ctrl + K, Ctrl + S', action: 'Open keyboard shortcuts' },
      { keys: 'Ctrl + K, Ctrl + T', action: 'Open theme picker' },
      { keys: 'Ctrl + `', action: 'Toggle terminal' },
      { keys: 'Ctrl + Shift + P', action: 'Open command terminal' },
      { keys: 'Ctrl + S', action: 'Save document' },
    ],
  },
  {
    title: 'Pages',
    shortcuts: [
      { keys: 'Ctrl + Alt + N', action: 'New page' },
      { keys: 'Ctrl + Alt + W', action: 'Close current page' },
      { keys: 'Ctrl + Alt + T', action: 'Edit page title' },
      { keys: 'Ctrl + I', action: 'Cycle page orientation (portrait → landscape → fullscreen)' },
      { keys: 'Ctrl + Shift + ← / →', action: 'Previous / next page (animated)' },
      { keys: 'Ctrl + Tab', action: 'Next page' },
      { keys: 'Ctrl + Shift + Tab', action: 'Previous page' },
      { keys: 'Ctrl + PageDown', action: 'Next page' },
      { keys: 'Ctrl + PageUp', action: 'Previous page' },
      { keys: 'Alt + ← / →', action: 'Previous / next page' },
      { keys: 'Ctrl + Alt + ↑ / ↓', action: 'Previous / next page' },
      { keys: 'Ctrl + 1–9', action: 'Jump to page (chain digits, e.g. Ctrl+1 then Ctrl+3 → page 13)' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { keys: 'Ctrl + Z', action: 'Undo' },
      { keys: 'Ctrl + Y', action: 'Redo' },
      { keys: 'Ctrl + B', action: 'Bold' },
      { keys: 'Ctrl + Shift + I', action: 'Italic' },
      { keys: 'Ctrl + Shift + S', action: 'Strikethrough' },
      { keys: 'Ctrl + E', action: 'Inline code' },
      { keys: 'Ctrl + Alt + C', action: 'Code block (syntax highlighted)' },
      { keys: 'Ctrl + Shift + 8', action: 'Bullet list' },
      { keys: 'Ctrl + Shift + 7', action: 'Ordered list' },
      { keys: 'Ctrl + Shift + H', action: 'Heading 2' },
      { keys: 'Ctrl + Alt + 1–3', action: 'Heading level 1–3' },
      { keys: 'Ctrl + Shift + B', action: 'Blockquote' },
      { keys: 'Ctrl + Enter', action: 'Line break' },
      { keys: '::', action: 'Open emoji & reaction picker (type ::smile to filter)' },
      { keys: ':name: or :name + Space', action: 'Insert emoji or animated GIF (e.g. :smile:, :partyparrot:)' },
      { keys: '/', action: 'Open block command menu (type /heading, /quote, /curl, etc.)' },
      { keys: 'Tab', action: 'Insert 4 spaces (accepts inline suggestion or popover when open)' },
      { keys: '↑ / ↓', action: 'Navigate popover suggestions (2+ letters)' },
      { keys: 'Enter', action: 'Accept popover suggestion' },
    ],
  },
]

export const SHORTCUT_REFERENCE = SHORTCUT_GROUPS.flatMap((group) => group.shortcuts)
