import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import type { DocumentPage } from '../types'
import type { PageOrientation } from '../utils/pageOrientation'
import { AnimatedCursor } from './AnimatedCursor'
import { EmojiPicker } from './EmojiPicker'
import { SlashCommandPicker } from './SlashCommandPicker'
import { AgentPicker } from './AgentPicker'
import { WordSuggestions } from './WordSuggestions'
import { InlineWordSuggestion } from './InlineWordSuggestion'
import { useDictionaryWorker } from '../hooks/useDictionaryWorker'
import { usePredictionWorker } from '../hooks/usePredictionWorker'
import { useAgentWorker } from '../hooks/useAgentWorker'
import { useWordMemory } from '../hooks/useWordMemory'
import { EditorShortcuts } from '../extensions/editorShortcuts'
import { ColorPreview } from '../extensions/colorPreview'
import { DateTimePreview } from '../extensions/dateTimePreview'
import { CodeBlockHighlight } from '../extensions/codeBlockHighlight'
import { CalendarBlock } from '../extensions/calendarBlock'
import { CurlBlock } from '../extensions/curlBlock'
import { HttpResult } from '../extensions/httpResult'
import { AgentMention } from '../extensions/agentMention'
import { AgentOutput } from '../extensions/agentOutput'
import { AgentOutputLock } from '../extensions/agentOutputLock'
import { ParagraphWithAgentOutput } from '../extensions/paragraphWithAgentOutput'
import { TodoTaskItem, TodoTaskList } from '../extensions/todo'
import { DocumentLink } from '../extensions/linkExtension'
import { EmojiImage } from '../extensions/emojiImage'
import { EmojiReplacer } from '../extensions/emojiReplacer'
import { analyzeContext } from '../utils/contextAnalyzer'
import {
  getCompletedClauseTokens,
  getLineJustCompleted,
  getParagraphJustCompleted,
  isSentenceLearningUpdate,
} from '../utils/wordAtCursor'
import { mergePredictionResults, type RankedSuggestion } from '../utils/suggestionMerge'
import { formatPageCreatedAt } from '../utils/formatPageDate'
import { focusAtDocumentEnd, isAtDocumentStart } from '../utils/editorSelection'
import { getSurfaceCaretCoords } from '../utils/caretCoords'
import { getSuggestionUi, buildSuggestionInsertion } from '../utils/applySuggestionCasing'
import {
  EMOJI_PICKER_COLS,
  getEmojiPickerContext,
  insertEmojiPickerItem,
  searchEmojiPickerItems,
  type EmojiPickerItem,
} from '../utils/emojiPicker'
import {
  getSlashCommandPickerContext,
  insertSlashCommand,
  searchSlashCommands,
  type SlashCommandPickerItem,
} from '../utils/slashCommandPicker'
import {
  appendAgentChunk,
  appendAgentStatus,
  ensureCursorInEditableParagraph,
  ensureParagraphAfterBlock,
  finalizeAgentOutput,
  getAgentInvocationAtCursor,
  getAgentPickerContext,
  insertAgentMention,
  isCursorInLockedAgentOutput,
  searchAgentPickerItems,
  startAgentOutput,
  type AgentPickerItem,
} from '../utils/agentMention'
import {
  deleteAgentOutputBlock,
  tryDeleteAgentOutputOnBackspace,
} from '../utils/agentOutputDelete'
import { getGeminiApiKey } from '../runtime/keyStore'
import { executeNoteTool, serializeNotePage } from '../utils/noteBlocks'

interface EditorProps {
  page: DocumentPage
  orientation: PageOrientation
  onUpdate: (content: string) => void
  onRenameTitle: (title: string) => void
  onRegisterEditTitle: (fn: () => void) => void
  onRegisterFocusEditor: (fn: () => boolean) => void
}

interface SuggestionState {
  open: boolean
  ui: 'inline' | 'popover'
  suggestions: RankedSuggestion[]
  selectedIndex: number
  prefix: string
  from: number
  to: number
  top: number
  left: number
  lineHeight: number
  fontSize: string
  fontWeight: string
  loading: boolean
  mode: 'prefix' | 'next-word'
}

const CLOSED_SUGGESTIONS: SuggestionState = {
  open: false,
  ui: 'inline',
  suggestions: [],
  selectedIndex: 0,
  prefix: '',
  from: 0,
  to: 0,
  top: 0,
  left: 0,
  lineHeight: 0,
  fontSize: '',
  fontWeight: '',
  loading: false,
  mode: 'prefix',
}

interface EmojiPickerState {
  open: boolean
  query: string
  from: number
  to: number
  items: EmojiPickerItem[]
  selectedIndex: number
  top: number
  left: number
}

const CLOSED_EMOJI_PICKER: EmojiPickerState = {
  open: false,
  query: '',
  from: 0,
  to: 0,
  items: [],
  selectedIndex: 0,
  top: 0,
  left: 0,
}

interface SlashCommandPickerState {
  open: boolean
  query: string
  from: number
  to: number
  items: SlashCommandPickerItem[]
  selectedIndex: number
  top: number
  left: number
}

const CLOSED_SLASH_COMMAND_PICKER: SlashCommandPickerState = {
  open: false,
  query: '',
  from: 0,
  to: 0,
  items: [],
  selectedIndex: 0,
  top: 0,
  left: 0,
}

interface AgentPickerState {
  open: boolean
  query: string
  from: number
  to: number
  items: AgentPickerItem[]
  selectedIndex: number
  top: number
  left: number
}

const CLOSED_AGENT_PICKER: AgentPickerState = {
  open: false,
  query: '',
  from: 0,
  to: 0,
  items: [],
  selectedIndex: 0,
  top: 0,
  left: 0,
}

function getCaretCoords(
  editor: TiptapEditor,
  surface: HTMLElement,
  placement: 'inline' | 'popover' = 'popover',
) {
  return getSurfaceCaretCoords(editor, surface, placement)
}

let skipInitialEndFocus = true

export function Editor({
  page,
  orientation,
  onUpdate,
  onRenameTitle,
  onRegisterEditTitle,
  onRegisterFocusEditor,
}: EditorProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<TiptapEditor | null>(null)
  const suggestionRef = useRef(CLOSED_SUGGESTIONS)
  const emojiPickerRef = useRef(CLOSED_EMOJI_PICKER)
  const slashCommandPickerRef = useRef(CLOSED_SLASH_COMMAND_PICKER)
  const agentPickerRef = useRef(CLOSED_AGENT_PICKER)
  const searchTokenRef = useRef(0)
  const refreshSuggestionsRef = useRef<(editor: TiptapEditor) => Promise<void>>(async () => {})
  const [draftTitle, setDraftTitle] = useState(page.title)
  const createdAt = formatPageCreatedAt(page.createdAt ?? page.updatedAt)
  const handleSuggestionKeyDownRef = useRef<(editor: TiptapEditor, event: KeyboardEvent) => boolean>(
    () => false,
  )
  const handleEmojiPickerKeyDownRef = useRef<(editor: TiptapEditor, event: KeyboardEvent) => boolean>(
    () => false,
  )
  const handleSlashCommandPickerKeyDownRef = useRef<
    (editor: TiptapEditor, event: KeyboardEvent) => boolean
  >(() => false)
  const handleAgentPickerKeyDownRef = useRef<
    (editor: TiptapEditor, event: KeyboardEvent) => boolean
  >(() => false)
  const runAgentInvocationRef = useRef<
    (editor: TiptapEditor, invocation: NonNullable<ReturnType<typeof getAgentInvocationAtCursor>>) => void
  >(() => {})
  const { ready: dictionaryReady, searchDebounced } = useDictionaryWorker()
  const { ready: predictionReady, predictDebounced, pushSessionLearning } = usePredictionWorker()
  const { runAgent } = useAgentWorker()
  const {
    learnFromAccept,
    learnFromSentence,
    learnFromDocument,
    registerSessionLearnHandler,
  } = useWordMemory()
  const [suggestions, setSuggestions] = useState<SuggestionState>(CLOSED_SUGGESTIONS)
  const [emojiPicker, setEmojiPicker] = useState<EmojiPickerState>(CLOSED_EMOJI_PICKER)
  const [slashCommandPicker, setSlashCommandPicker] =
    useState<SlashCommandPickerState>(CLOSED_SLASH_COMMAND_PICKER)
  const [agentPicker, setAgentPicker] = useState<AgentPickerState>(CLOSED_AGENT_PICKER)

  const workersReady = predictionReady

  const startTitleEdit = useCallback(() => {
    setDraftTitle(page.title)
    requestAnimationFrame(() => {
      const input = titleInputRef.current
      input?.focus()
      input?.select()
    })
  }, [page.title])

  const cancelTitleEdit = useCallback(() => {
    setDraftTitle(page.title)
    titleInputRef.current?.blur()
  }, [page.title])

  const commitTitleEdit = useCallback(() => {
    const trimmed = draftTitle.trim()
    if (trimmed && trimmed !== page.title) {
      onRenameTitle(trimmed)
    } else {
      setDraftTitle(page.title)
    }
  }, [draftTitle, onRenameTitle, page.title])

  useEffect(() => {
    onRegisterEditTitle(startTitleEdit)
  }, [onRegisterEditTitle, startTitleEdit])

  const focusEditor = useCallback(() => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return false
    return ed.commands.focus()
  }, [])

  useEffect(() => {
    onRegisterFocusEditor(focusEditor)
  }, [onRegisterFocusEditor, focusEditor])

  useEffect(() => {
    setDraftTitle(page.title)
  }, [page.id, page.title])

  useEffect(() => {
    void learnFromDocument(page.content)
  }, [page.id, learnFromDocument])

  const updateSuggestionRef = useCallback((next: SuggestionState) => {
    suggestionRef.current = next
    setSuggestions(next)
  }, [])

  const closeSuggestions = useCallback(() => {
    searchTokenRef.current += 1
    updateSuggestionRef(CLOSED_SUGGESTIONS)
  }, [updateSuggestionRef])

  const updateEmojiPickerRef = useCallback((next: EmojiPickerState) => {
    emojiPickerRef.current = next
    setEmojiPicker(next)
  }, [])

  const closeEmojiPicker = useCallback(() => {
    updateEmojiPickerRef(CLOSED_EMOJI_PICKER)
  }, [updateEmojiPickerRef])

  const updateSlashCommandPickerRef = useCallback((next: SlashCommandPickerState) => {
    slashCommandPickerRef.current = next
    setSlashCommandPicker(next)
  }, [])

  const closeSlashCommandPicker = useCallback(() => {
    updateSlashCommandPickerRef(CLOSED_SLASH_COMMAND_PICKER)
  }, [updateSlashCommandPickerRef])

  const updateAgentPickerRef = useCallback((next: AgentPickerState) => {
    agentPickerRef.current = next
    setAgentPicker(next)
  }, [])

  const closeAgentPicker = useCallback(() => {
    updateAgentPickerRef(CLOSED_AGENT_PICKER)
  }, [updateAgentPickerRef])

  const focusEditorStart = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    ed.commands.focus('start')
    closeSuggestions()
  }, [closeSuggestions])

  const focusTitleEnd = useCallback(() => {
    const input = titleInputRef.current
    if (!input) return
    closeSuggestions()
    closeEmojiPicker()
    closeSlashCommandPicker()
    closeAgentPicker()
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }, [closeSuggestions, closeEmojiPicker, closeSlashCommandPicker, closeAgentPicker])

  const acceptSuggestion = useCallback(
    async (editor: TiptapEditor, state = suggestionRef.current) => {
      if (!state.open || state.suggestions.length === 0) return false

      const entry = state.suggestions[state.selectedIndex]
      if (!entry) return false

      const live = analyzeContext(editor.state)
      const mode = live?.mode ?? state.mode
      const prefix = live?.prefix ?? state.prefix
      const insertPos = editor.state.selection.from
      const $pos = editor.state.doc.resolve(insertPos)
      const textAfterCursor = $pos.parent.textContent.slice($pos.parentOffset)
      const insertion = buildSuggestionInsertion(mode, prefix, entry.word, textAfterCursor)

      if (insertion) {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.insertText(insertion, insertPos)
            return true
          })
          .run()
      }

      if (live?.bigramKey) {
        await learnFromAccept(live.bigramKey, entry.word)
      }
      if (live?.trigramKey) {
        await learnFromAccept(live.trigramKey, entry.word)
      }
      if (live?.fourgramKey) {
        await learnFromAccept(live.fourgramKey, entry.word)
      }

      await refreshSuggestionsRef.current(editor)
      return true
    },
    [learnFromAccept],
  )

  const learnFromEditor = useCallback(
    async (editor: TiptapEditor) => {
      const clause = getCompletedClauseTokens(editor.state)
      if (clause) {
        await learnFromSentence(clause)
        return
      }

      const line = getLineJustCompleted(editor.state)
      if (line) {
        await learnFromSentence(line)
        return
      }

      const paragraph = getParagraphJustCompleted(editor.state)
      if (paragraph) {
        await learnFromSentence(paragraph)
      }
    },
    [learnFromSentence],
  )

  useEffect(() => {
    registerSessionLearnHandler(pushSessionLearning)
    return () => registerSessionLearnHandler(null)
  }, [pushSessionLearning, registerSessionLearnHandler])

  const refreshSuggestions = useCallback(
    async (editor: TiptapEditor) => {
      const surface = surfaceRef.current
      if (!surface || !workersReady) {
        closeSuggestions()
        return
      }

      const context = analyzeContext(editor.state)
      if (!context) {
        closeSuggestions()
        return
      }

      const ui = getSuggestionUi(context)

      const coords = getCaretCoords(editor, surface, ui)
      const token = ++searchTokenRef.current

      const previous =
        suggestionRef.current.open && suggestionRef.current.ui === ui
          ? suggestionRef.current.suggestions
          : []

      updateSuggestionRef({
        open: true,
        ui,
        suggestions: previous,
        selectedIndex: 0,
        prefix: context.prefix,
        from: context.from,
        to: context.to,
        top: coords.top,
        left: coords.left,
        lineHeight: coords.lineHeight,
        fontSize: coords.fontSize,
        fontWeight: coords.fontWeight,
        loading: previous.length === 0,
        mode: context.mode,
      })

      const normalizedPrefix = context.prefix.toLowerCase()

      const [predictionCandidates, dictionaryWords] = await Promise.all([
        predictDebounced(context, 10, 20),
        context.mode === 'prefix' && normalizedPrefix.length >= 2
          ? searchDebounced(normalizedPrefix, 10)
          : Promise.resolve([]),
      ])

      if (token !== searchTokenRef.current) return

      const ranked = mergePredictionResults(predictionCandidates, dictionaryWords, {
        exclude:
          context.mode === 'prefix' && normalizedPrefix.length >= 2 ? normalizedPrefix : undefined,
        limit: 8,
      })

      if (ranked.length === 0) {
        closeSuggestions()
        return
      }

      const latestCoords = getCaretCoords(editor, surface, ui)
      updateSuggestionRef({
        open: true,
        ui,
        suggestions: ranked,
        selectedIndex: 0,
        prefix: context.prefix,
        from: context.from,
        to: context.to,
        top: latestCoords.top,
        left: latestCoords.left,
        lineHeight: latestCoords.lineHeight,
        fontSize: latestCoords.fontSize,
        fontWeight: latestCoords.fontWeight,
        loading: false,
        mode: context.mode,
      })
    },
    [
      closeSuggestions,
      predictDebounced,
      searchDebounced,
      updateSuggestionRef,
      workersReady,
    ],
  )

  refreshSuggestionsRef.current = refreshSuggestions

  useEffect(() => {
    if (!predictionReady) return
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || !ed.isFocused) return
    void refreshSuggestions(ed)
  }, [predictionReady, dictionaryReady, refreshSuggestions])

  const acceptEmojiPicker = useCallback(
    (editor: TiptapEditor, state = emojiPickerRef.current) => {
      const item = state.items[state.selectedIndex]
      if (!state.open || !item) return false

      insertEmojiPickerItem(editor, item, state.from, state.to)
      closeEmojiPicker()
      return true
    },
    [closeEmojiPicker],
  )

  const acceptSlashCommandPicker = useCallback(
    (editor: TiptapEditor, state = slashCommandPickerRef.current) => {
      const item = state.items[state.selectedIndex]
      if (!state.open || !item) return false

      const fresh = getSlashCommandPickerContext(editor.state)
      insertSlashCommand(
        editor,
        item.command,
        fresh?.from ?? state.from,
        fresh?.to ?? state.to,
      )
      closeSlashCommandPicker()
      closeSuggestions()
      return true
    },
    [closeSlashCommandPicker, closeSuggestions],
  )

  const refreshSlashCommandPicker = useCallback(
    (editor: TiptapEditor) => {
      const surface = surfaceRef.current
      const context = getSlashCommandPickerContext(editor.state)
      if (!surface || !context) {
        closeSlashCommandPicker()
        return false
      }

      closeSuggestions()
      closeEmojiPicker()
      closeAgentPicker()

      const coords = getCaretCoords(editor, surface)
      const items = searchSlashCommands(context.query)
      const previous = slashCommandPickerRef.current
      const selectedIndex =
        previous.open &&
        previous.query === context.query &&
        previous.selectedIndex < items.length
          ? previous.selectedIndex
          : 0

      updateSlashCommandPickerRef({
        open: true,
        query: context.query,
        from: context.from,
        to: context.to,
        items,
        selectedIndex,
        top: coords.top,
        left: coords.left,
      })
      return true
    },
    [closeAgentPicker, closeEmojiPicker, closeSlashCommandPicker, closeSuggestions, updateSlashCommandPickerRef],
  )

  const refreshEmojiPicker = useCallback(
    (editor: TiptapEditor) => {
      const surface = surfaceRef.current
      const context = getEmojiPickerContext(editor.state)
      if (!surface || !context) {
        closeEmojiPicker()
        return false
      }

      closeSuggestions()
      closeAgentPicker()

      const coords = getCaretCoords(editor, surface)
      const items = searchEmojiPickerItems(context.query)
      const previous = emojiPickerRef.current
      const selectedIndex =
        previous.open &&
        previous.query === context.query &&
        previous.selectedIndex < items.length
          ? previous.selectedIndex
          : 0

      updateEmojiPickerRef({
        open: true,
        query: context.query,
        from: context.from,
        to: context.to,
        items,
        selectedIndex,
        top: coords.top,
        left: coords.left,
      })
      return true
    },
    [closeAgentPicker, closeEmojiPicker, closeSuggestions, updateEmojiPickerRef],
  )

  const runAgentInvocation = useCallback(
    async (editor: TiptapEditor, invocation: NonNullable<ReturnType<typeof getAgentInvocationAtCursor>>) => {
      closeAgentPicker()
      closeSuggestions()
      closeEmojiPicker()
      closeSlashCommandPicker()

      const { runId } = startAgentOutput(editor, invocation)
      const apiKey = await getGeminiApiKey()

      if (!apiKey) {
        appendAgentChunk(
          editor,
          runId,
          'Error: Gemini API key not set. Open terminal (Ctrl+`) and run: gemini --set-key',
        )
        finalizeAgentOutput(editor, runId)
        return
      }

      const documentContext =
        invocation.agentId === 'bro' ? serializeNotePage(editor, page.title) : undefined

      runAgent(
        invocation.agentId,
        invocation.prompt,
        apiKey,
        {
          onStatus: (text) => {
            appendAgentStatus(editor, runId, text)
          },
          onChunk: (chunk) => {
            appendAgentChunk(editor, runId, chunk)
          },
          onDone: () => {
            finalizeAgentOutput(editor, runId)
          },
          onError: (message) => {
            appendAgentChunk(editor, runId, `\nError: ${message}`)
            finalizeAgentOutput(editor, runId)
          },
          onHostTool: async (name, params) => {
            const current = editorRef.current ?? editor
            return executeNoteTool(current, name, params, page.title)
          },
        },
        documentContext,
      )
    },
    [
      closeAgentPicker,
      closeEmojiPicker,
      closeSlashCommandPicker,
      closeSuggestions,
      runAgent,
      page.title,
    ],
  )

  runAgentInvocationRef.current = runAgentInvocation

  const acceptAgentPicker = useCallback(
    (editor: TiptapEditor, state = agentPickerRef.current) => {
      const item = state.items[state.selectedIndex]
      if (!state.open || !item) return false

      insertAgentMention(editor, item.agent.id, state.from, state.to)
      closeAgentPicker()
      return true
    },
    [closeAgentPicker],
  )

  const refreshAgentPicker = useCallback(
    (editor: TiptapEditor) => {
      const surface = surfaceRef.current
      const context = getAgentPickerContext(editor.state)
      if (!surface || !context) {
        closeAgentPicker()
        return false
      }

      closeSuggestions()
      closeEmojiPicker()
      closeSlashCommandPicker()

      const coords = getCaretCoords(editor, surface)
      const items = searchAgentPickerItems(context.query)
      const previous = agentPickerRef.current
      const selectedIndex =
        previous.open &&
        previous.query === context.query &&
        previous.selectedIndex < items.length
          ? previous.selectedIndex
          : 0

      updateAgentPickerRef({
        open: true,
        query: context.query,
        from: context.from,
        to: context.to,
        items,
        selectedIndex,
        top: coords.top,
        left: coords.left,
      })
      return true
    },
    [closeAgentPicker, closeEmojiPicker, closeSlashCommandPicker, closeSuggestions, updateAgentPickerRef],
  )

  const refreshEditorAssist = useCallback(
    async (editor: TiptapEditor, fromTyping = false) => {
      if (refreshSlashCommandPicker(editor)) return
      if (refreshAgentPicker(editor)) return
      if (refreshEmojiPicker(editor)) return
      if (!fromTyping) {
        closeSuggestions()
        return
      }
      await refreshSuggestions(editor)
    },
    [
      closeSuggestions,
      refreshSlashCommandPicker,
      refreshAgentPicker,
      refreshEmojiPicker,
      refreshSuggestions,
    ],
  )

  const handleSlashCommandPickerKeyDown = useCallback(
    (editor: TiptapEditor, event: KeyboardEvent) => {
      const state = slashCommandPickerRef.current
      if (!state.open) return false

      const { items, selectedIndex } = state

      if (event.key === 'ArrowDown' && items.length > 0) {
        event.preventDefault()
        updateSlashCommandPickerRef({
          ...state,
          selectedIndex: Math.min(selectedIndex + 1, items.length - 1),
        })
        return true
      }

      if (event.key === 'ArrowUp' && items.length > 0) {
        event.preventDefault()
        updateSlashCommandPickerRef({
          ...state,
          selectedIndex: Math.max(selectedIndex - 1, 0),
        })
        return true
      }

      if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        event.stopPropagation()
        if (items.length > 0) {
          acceptSlashCommandPicker(editor, state)
        } else {
          closeSlashCommandPicker()
        }
        return true
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashCommandPicker()
        return true
      }

      return false
    },
    [acceptSlashCommandPicker, closeSlashCommandPicker, updateSlashCommandPickerRef],
  )

  handleSlashCommandPickerKeyDownRef.current = handleSlashCommandPickerKeyDown

  const handleAgentPickerKeyDown = useCallback(
    (editor: TiptapEditor, event: KeyboardEvent) => {
      const state = agentPickerRef.current
      if (!state.open) return false

      const { items, selectedIndex } = state

      if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        event.stopPropagation()
        if (items.length > 0) {
          acceptAgentPicker(editor, state)
        } else {
          closeAgentPicker()
        }
        return true
      }

      if (event.key === 'ArrowDown' && items.length > 0) {
        event.preventDefault()
        updateAgentPickerRef({
          ...state,
          selectedIndex: Math.min(selectedIndex + 1, items.length - 1),
        })
        return true
      }

      if (event.key === 'ArrowUp' && items.length > 0) {
        event.preventDefault()
        updateAgentPickerRef({
          ...state,
          selectedIndex: Math.max(selectedIndex - 1, 0),
        })
        return true
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeAgentPicker()
        return true
      }

      return false
    },
    [acceptAgentPicker, closeAgentPicker, updateAgentPickerRef],
  )

  handleAgentPickerKeyDownRef.current = handleAgentPickerKeyDown

  const handleEmojiPickerKeyDown = useCallback(
    (editor: TiptapEditor, event: KeyboardEvent) => {
      const state = emojiPickerRef.current
      if (!state.open) return false

      const { items, selectedIndex } = state
      const colCount = EMOJI_PICKER_COLS

      if (event.key === 'ArrowRight' && items.length > 0) {
        event.preventDefault()
        updateEmojiPickerRef({
          ...state,
          selectedIndex: Math.min(selectedIndex + 1, items.length - 1),
        })
        return true
      }

      if (event.key === 'ArrowLeft' && items.length > 0) {
        event.preventDefault()
        updateEmojiPickerRef({
          ...state,
          selectedIndex: Math.max(selectedIndex - 1, 0),
        })
        return true
      }

      if (event.key === 'ArrowDown' && items.length > 0) {
        event.preventDefault()
        updateEmojiPickerRef({
          ...state,
          selectedIndex: Math.min(selectedIndex + colCount, items.length - 1),
        })
        return true
      }

      if (event.key === 'ArrowUp' && items.length > 0) {
        event.preventDefault()
        updateEmojiPickerRef({
          ...state,
          selectedIndex: Math.max(selectedIndex - colCount, 0),
        })
        return true
      }

      if (event.key === 'Enter' && !(event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        if (items.length > 0) {
          acceptEmojiPicker(editor, state)
        } else {
          closeEmojiPicker()
        }
        return true
      }

      if (event.key === 'Tab' && items.length > 0) {
        event.preventDefault()
        acceptEmojiPicker(editor, state)
        return true
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeEmojiPicker()
        return true
      }

      return false
    },
    [acceptEmojiPicker, closeEmojiPicker, updateEmojiPickerRef],
  )

  handleEmojiPickerKeyDownRef.current = handleEmojiPickerKeyDown

  const handleSuggestionKeyDown = useCallback(
    (editor: TiptapEditor, event: KeyboardEvent) => {
      if (
        slashCommandPickerRef.current.open ||
        emojiPickerRef.current.open ||
        agentPickerRef.current.open
      ) {
        return false
      }

      const state = suggestionRef.current
      if (!state.open || state.suggestions.length === 0) return false

      if (state.ui === 'popover') {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          const nextIndex = (state.selectedIndex + 1) % state.suggestions.length
          updateSuggestionRef({ ...state, selectedIndex: nextIndex })
          return true
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          const nextIndex =
            (state.selectedIndex - 1 + state.suggestions.length) % state.suggestions.length
          updateSuggestionRef({ ...state, selectedIndex: nextIndex })
          return true
        }
      }

      if (state.ui === 'inline') {
        if (event.key === 'Tab') {
          event.preventDefault()
          void acceptSuggestion(editor, state)
          return true
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          closeSuggestions()
          return true
        }

        return false
      }

      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        closeSuggestions()
        return false
      }

      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault()
        void acceptSuggestion(editor, state)
        return true
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        closeSuggestions()
        return true
      }

      return false
    },
    [acceptSuggestion, closeSuggestions, updateSuggestionRef],
  )

  handleSuggestionKeyDownRef.current = handleSuggestionKeyDown

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        paragraph: false,
      }),
      ParagraphWithAgentOutput,
      Placeholder.configure({
        placeholder: 'Start writing…',
      }),
      CharacterCount,
      EditorShortcuts,
      DocumentLink,
      EmojiImage,
      EmojiReplacer,
      ColorPreview,
      DateTimePreview,
      TodoTaskList,
      TodoTaskItem,
      CurlBlock,
      CalendarBlock,
      HttpResult,
      AgentMention,
      AgentOutput,
      AgentOutputLock,
      CodeBlockHighlight,
    ],
    content: page.content,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'true',
        id: 'main-editor',
        role: 'textbox',
        'aria-label': 'Document editor',
        'aria-multiline': 'true',
      },
      handleClick: (_view, _pos, event) => {
        const ed = editorRef.current
        if (!ed) return false
        const target = event.target
        if (target instanceof HTMLElement && target.closest('.agent-output')) {
          return false
        }
        requestAnimationFrame(() => {
          if (isCursorInLockedAgentOutput(ed.state)) {
            ensureCursorInEditableParagraph(ed)
          }
        })
        return false
      },
      handleKeyDown: (_view, event) => {
        const ed = editorRef.current
        if (!ed) return false
        if (
          event.key === 'ArrowUp' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !suggestionRef.current.open &&
          !emojiPickerRef.current.open &&
          !slashCommandPickerRef.current.open &&
          !agentPickerRef.current.open &&
          isAtDocumentStart(ed)
        ) {
          event.preventDefault()
          focusTitleEnd()
          return true
        }

        if (handleSlashCommandPickerKeyDownRef.current(ed, event)) {
          return true
        }

        if (handleAgentPickerKeyDownRef.current(ed, event)) {
          return true
        }

        if (handleEmojiPickerKeyDownRef.current(ed, event)) {
          return true
        }

        if (isCursorInLockedAgentOutput(ed.state)) {
          if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            const blockPos = ed.state.selection.$from.before(ed.state.selection.$from.depth)
            deleteAgentOutputBlock(ed, blockPos)
            return true
          }

          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowRight' ||
            event.key === 'Enter' ||
            event.key === 'Tab' ||
            event.key.length === 1
          ) {
            event.preventDefault()
            const blockPos = ed.state.selection.$from.before(ed.state.selection.$from.depth)
            ensureParagraphAfterBlock(ed, blockPos)
            return true
          }
        }

        if (
          (event.key === 'Backspace' || event.key === 'Delete') &&
          tryDeleteAgentOutputOnBackspace(ed)
        ) {
          event.preventDefault()
          return true
        }

        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey
        ) {
          event.preventDefault()
          const invocation = getAgentInvocationAtCursor(ed.state)
          if (invocation) {
            void runAgentInvocationRef.current(ed, invocation)
          } else {
            ed.commands.setHardBreak()
          }
          return true
        }

        if (handleSuggestionKeyDownRef.current(ed, event)) {
          return true
        }

        if (
          event.key === 'Tab' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault()
          ed.chain().focus().insertContent('    ').run()
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: ed, transaction }) => {
      onUpdate(ed.getHTML())
      void (async () => {
        if (isSentenceLearningUpdate(transaction)) {
          await learnFromEditor(ed)
        }
        await refreshEditorAssist(ed, true)
      })()
    },
    onSelectionUpdate: ({ editor: ed, transaction }) => {
      if (transaction.docChanged) return
      void refreshEditorAssist(ed, false)
    },
  })

  useEffect(() => {
    editorRef.current = editor ?? null
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== page.content) {
      editor.commands.setContent(page.content, false)
    }
  }, [page.id, editor])

  useEffect(() => {
    if (!editor) return
    if (skipInitialEndFocus) {
      skipInitialEndFocus = false
      return
    }
    const frame = requestAnimationFrame(() => {
      focusAtDocumentEnd(editor)
      ensureCursorInEditableParagraph(editor)
    })
    return () => cancelAnimationFrame(frame)
  }, [page.id, editor])

  useEffect(() => {
    if (!editor) return

    const handleBlur = () => {
      window.setTimeout(() => {
        closeSuggestions()
        closeEmojiPicker()
        closeSlashCommandPicker()
        closeAgentPicker()
      }, 120)
    }

    editor.on('blur', handleBlur)
    return () => {
      editor.off('blur', handleBlur)
    }
  }, [editor, closeSuggestions, closeEmojiPicker, closeSlashCommandPicker, closeAgentPicker])

  return (
    <div className="editor-shell">
      <div
        className="editor-page"
        data-export-target
        data-orientation={orientation}
        ref={pageRef}
      >
        {editor && (
          <AnimatedCursor editor={editor} pageRef={pageRef} titleInputRef={titleInputRef} />
        )}
        <header className="page-header">
          <input
            ref={titleInputRef}
            className="page-title-input"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault()
                focusEditorStart()
                return
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitleEdit()
                focusEditorStart()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelTitleEdit()
              }
            }}
            aria-label="Page title"
          />
          <p className="page-meta">
            <time dateTime={createdAt.iso}>{createdAt.date}</time>
            <span className="page-meta-sep" aria-hidden="true">
              ·
            </span>
            <time dateTime={createdAt.iso}>{createdAt.time}</time>
          </p>
        </header>

        <div className="editor-surface" ref={surfaceRef}>
          <EditorContent editor={editor} />
          <SlashCommandPicker
            open={slashCommandPicker.open}
            items={slashCommandPicker.items}
            selectedIndex={slashCommandPicker.selectedIndex}
            query={slashCommandPicker.query}
            top={slashCommandPicker.top}
            left={slashCommandPicker.left}
            onSelect={(item) => {
              const ed = editorRef.current
              if (!ed) return
              insertSlashCommand(ed, item.command, slashCommandPicker.from, slashCommandPicker.to)
              closeSlashCommandPicker()
            }}
          />
          <AgentPicker
            open={agentPicker.open}
            items={agentPicker.items}
            selectedIndex={agentPicker.selectedIndex}
            query={agentPicker.query}
            top={agentPicker.top}
            left={agentPicker.left}
            onSelect={(item) => {
              const ed = editorRef.current
              if (!ed) return
              insertAgentMention(ed, item.agent.id, agentPicker.from, agentPicker.to)
              closeAgentPicker()
            }}
          />
          <EmojiPicker
            open={emojiPicker.open}
            items={emojiPicker.items}
            selectedIndex={emojiPicker.selectedIndex}
            query={emojiPicker.query}
            top={emojiPicker.top}
            left={emojiPicker.left}
            onSelect={(item) => {
              const ed = editorRef.current
              if (!ed) return
              insertEmojiPickerItem(ed, item, emojiPicker.from, emojiPicker.to)
              closeEmojiPicker()
            }}
          />
          <InlineWordSuggestion
            open={suggestions.open && suggestions.ui === 'inline'}
            loading={suggestions.loading}
            suggestions={suggestions.suggestions}
            selectedIndex={suggestions.selectedIndex}
            prefix={suggestions.prefix}
            mode={suggestions.mode}
            top={suggestions.top}
            left={suggestions.left}
            lineHeight={suggestions.lineHeight}
            fontSize={suggestions.fontSize}
            fontWeight={suggestions.fontWeight}
          />
          <WordSuggestions
            open={suggestions.open && suggestions.ui === 'popover'}
            suggestions={suggestions.suggestions}
            selectedIndex={suggestions.selectedIndex}
            prefix={suggestions.prefix}
            top={suggestions.top}
            left={suggestions.left}
            loading={suggestions.loading}
            mode={suggestions.mode}
          />
        </div>
      </div>
    </div>
  )
}
