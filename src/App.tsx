import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor } from './components/Editor'
import { PageTransition } from './components/PageTransition'
import { DevTerminal } from './components/DevTerminal'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { ThemePickerDialog } from './components/ThemePickerDialog'
import { StatusBar } from './components/StatusBar'
import { useAppShortcuts } from './hooks/useAppShortcuts'
import { useTheme } from './hooks/useTheme'
import type { DocumentPage } from './types'
import { createPage, loadPages, savePages } from './utils/storage'
import { cancelPageJump } from './utils/shortcuts'
import { normalizePageOrientation, togglePageOrientation } from './utils/pageOrientation'

function App() {
  const { theme, setTheme, cycleTheme } = useTheme()
  const [pages, setPages] = useState<DocumentPage[]>(() => loadPages())
  const [activePageId, setActivePageId] = useState<string>(() => pages[0]?.id ?? createPage().id)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [pageTransition, setPageTransition] = useState<'forward' | 'back' | null>(null)
  const pagesRef = useRef(pages)
  const activePageIdRef = useRef(activePageId)
  pagesRef.current = pages
  activePageIdRef.current = activePageId

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0]
  const activePageIndex = pages.findIndex((p) => p.id === activePageId)

  useEffect(() => {
    savePages(pages)
  }, [pages])

  useEffect(() => {
    if (shortcutsOpen || themePickerOpen) cancelPageJump()
  }, [shortcutsOpen, themePickerOpen])

  const updatePageContent = useCallback((pageId: string, content: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, content, updatedAt: Date.now() } : p)),
    )
  }, [])

  const createNewPage = useCallback((title?: string) => {
    const page = createPage(title)
    setPages((prev) => [...prev, page])
    setActivePageId(page.id)
    return page
  }, [])

  const deletePage = useCallback((pageId: string) => {
    setPages((prev) => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex((p) => p.id === pageId)
      if (idx < 0) return prev
      const next = prev.filter((p) => p.id !== pageId)
      if (pageId === activePageIdRef.current) {
        setActivePageId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }, [])

  const renamePage = useCallback((pageId: string, title: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title, updatedAt: Date.now() } : p)),
    )
  }, [])

  const toggleActivePageOrientation = useCallback(() => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== activePageIdRef.current) return p
        const orientation = togglePageOrientation(normalizePageOrientation(p.orientation))
        return { ...p, orientation, updatedAt: Date.now() }
      }),
    )
  }, [])

  const goToNextPage = useCallback(() => {
    const currentPages = pagesRef.current
    const idx = currentPages.findIndex((p) => p.id === activePageIdRef.current)
    if (idx >= 0 && idx < currentPages.length - 1) {
      setPageTransition('forward')
      setActivePageId(currentPages[idx + 1].id)
    }
  }, [])

  const goToPrevPage = useCallback(() => {
    const currentPages = pagesRef.current
    const idx = currentPages.findIndex((p) => p.id === activePageIdRef.current)
    if (idx > 0) {
      setPageTransition('back')
      setActivePageId(currentPages[idx - 1].id)
    }
  }, [])

  const goToPage = useCallback((index: number) => {
    const currentPages = pagesRef.current
    const currentIdx = currentPages.findIndex((p) => p.id === activePageIdRef.current)
    if (index >= 0 && index < currentPages.length && index !== currentIdx) {
      setPageTransition(index > currentIdx ? 'forward' : 'back')
      setActivePageId(currentPages[index].id)
    }
  }, [])

  const saveDocument = useCallback(() => {
    savePages(pagesRef.current)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }, [])

  const editTitleRef = useRef<(() => void) | null>(null)
  const registerEditTitle = useCallback((fn: () => void) => {
    editTitleRef.current = fn
  }, [])

  const focusEditorRef = useRef<(() => boolean) | null>(null)
  const registerFocusEditor = useCallback((fn: () => boolean) => {
    focusEditorRef.current = fn
  }, [])

  const focusEditor = useCallback(() => {
    const tryFocus = () => {
      if (focusEditorRef.current?.()) return true
      const surface = document.querySelector<HTMLElement>('.ProseMirror')
      surface?.focus()
      return document.activeElement === surface
    }

    requestAnimationFrame(() => {
      if (tryFocus()) return
      requestAnimationFrame(() => {
        tryFocus()
      })
    })
  }, [])

  const terminalWasOpenRef = useRef(false)
  useEffect(() => {
    if (terminalOpen) {
      terminalWasOpenRef.current = true
      return
    }
    if (!terminalWasOpenRef.current) return
    terminalWasOpenRef.current = false
    focusEditor()
  }, [terminalOpen, focusEditor])

  useAppShortcuts(
    {
      goToNextPage,
      goToPrevPage,
      goToPage,
      createPage: () => createNewPage(),
      closePage: () => deletePage(activePageIdRef.current),
      save: saveDocument,
      editPageTitle: () => editTitleRef.current?.(),
      togglePageOrientation: toggleActivePageOrientation,
      toggleTerminal: () => setTerminalOpen((open) => !open),
      openTerminal: () => setTerminalOpen(true),
      openShortcutsViewer: () => setShortcutsOpen(true),
      openThemePicker: () => setThemePickerOpen(true),
    },
    { enabled: () => !shortcutsOpen && !themePickerOpen },
  )

  if (!activePage) {
    createNewPage('untitled')
    return null
  }

  return (
    <div className="app">
      <a href="#main-editor" className="skip-link">
        Skip to editor
      </a>

      <PageTransition
        pageId={activePage.id}
        direction={pageTransition}
        onAnimationEnd={() => setPageTransition(null)}
      >
        <Editor
          page={activePage}
          orientation={normalizePageOrientation(activePage.orientation)}
          onUpdate={(content) => updatePageContent(activePage.id, content)}
          onRenameTitle={(title) => renamePage(activePage.id, title)}
          onRegisterEditTitle={registerEditTitle}
          onRegisterFocusEditor={registerFocusEditor}
        />
      </PageTransition>

      <StatusBar
        page={activePage}
        orientation={normalizePageOrientation(activePage.orientation)}
        pageIndex={activePageIndex}
        totalPages={pages.length}
        terminalOpen={terminalOpen}
        savedFlash={savedFlash}
      />

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <ThemePickerDialog
        open={themePickerOpen}
        theme={theme}
        onSelectTheme={(next) => {
          setTheme(next)
          setThemePickerOpen(false)
        }}
        onClose={() => setThemePickerOpen(false)}
      />

      <DevTerminal
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        shortcutsOpen={shortcutsOpen}
        pages={pages}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onCreatePage={createNewPage}
        onDeletePage={deletePage}
        onRenamePage={renamePage}
        getPageContent={(id) => pagesRef.current.find((p) => p.id === id)?.content ?? ''}
        theme={theme}
        onSetTheme={setTheme}
        onCycleTheme={cycleTheme}
      />
    </div>
  )
}

export default App
