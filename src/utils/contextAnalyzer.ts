import type { EditorState } from '@tiptap/pm/state'
import { START_CONTEXT, WORD_TOKEN_RE } from './wordMemory'

const WORD_CHAR = /[A-Za-z\u00C0-\u024F'\u2019]/

export type PredictionMode = 'next-word' | 'prefix'

export interface AnalyzedContext {
  mode: PredictionMode
  prefix: string
  previousWords: string[]
  bigramKey: string
  trigramKey: string | null
  fourgramKey: string | null
  from: number
  to: number
}

function getTextblockContext(state: EditorState) {
  const { from } = state.selection
  if (!state.selection.empty) return null

  const $pos = state.doc.resolve(from)
  if (!$pos.parent.isTextblock) return null

  return {
    from,
    parentStart: $pos.start(),
    offset: $pos.parentOffset,
    text: $pos.parent.textContent,
  }
}

function extractTokens(text: string): string[] {
  return text.match(WORD_TOKEN_RE) ?? []
}

export function extractPreviousWords(text: string, offset: number, count = 4): string[] {
  const tokens = extractTokens(text.slice(0, offset))
  return tokens.slice(-count)
}

/** Completed words before the start of the word currently being typed. */
export function extractCompletedWordsBefore(text: string, wordStart: number, count = 4): string[] {
  const tokens = extractTokens(text.slice(0, wordStart))
  return tokens.slice(-count)
}

export function buildContextKeys(completedWords: string[]): {
  bigramKey: string
  trigramKey: string | null
  fourgramKey: string | null
} {
  const last = completedWords[completedWords.length - 1]
  const prev = completedWords[completedWords.length - 2]
  const prevPrev = completedWords[completedWords.length - 3]
  const bigramKey = last ? last.toLowerCase().replace(/\u2019/g, "'") : START_CONTEXT
  const trigramKey =
    last && prev
      ? `${prev.toLowerCase().replace(/\u2019/g, "'")} ${last.toLowerCase().replace(/\u2019/g, "'")}`
      : null
  const fourgramKey =
    last && prev && prevPrev
      ? `${prevPrev.toLowerCase().replace(/\u2019/g, "'")} ${prev.toLowerCase().replace(/\u2019/g, "'")} ${last.toLowerCase().replace(/\u2019/g, "'")}`
      : null

  return { bigramKey, trigramKey, fourgramKey }
}

/** Text on the current line before the cursor (within the same text block). */
export function getLineTextBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const lineBreak = before.lastIndexOf('\n')
  return lineBreak === -1 ? before : before.slice(lineBreak + 1)
}

export function isAtEmptyLineStart(text: string, offset: number): boolean {
  return getLineTextBeforeCursor(text, offset).trim().length === 0
}

/** True when the cursor follows sentence-ending punctuation (. ! ?). */
export function isAfterSentenceBoundary(text: string, offset: number): boolean {
  if (offset === 0) return false
  const before = text.slice(0, offset).replace(/\s+$/, '')
  if (!before) return false
  return /[.!?]$/.test(before)
}

function isTypingEmojiShortcode(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return /:([a-z0-9_+-]*)$/i.test(line)
}

function isEmojiPickerActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return /::([a-z0-9_+-]*)$/i.test(line)
}

function isSlashCommandActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return /(?:^|\s)\/([a-z0-9-]*)$/i.test(line)
}

function isAgentMentionActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return /(?:^|\s)@([a-z0-9_-]*)$/i.test(line)
}

export function analyzeContext(state: EditorState): AnalyzedContext | null {
  const ctx = getTextblockContext(state)
  if (!ctx) return null

  const { from, parentStart, offset, text } = ctx

  let start = offset
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) {
    start--
  }

  const partial = text.slice(start, offset)
  const charBefore = offset > 0 ? text[offset - 1] : ''
  const afterBoundary = offset === 0 || !WORD_CHAR.test(charBefore)

  if (isSlashCommandActive(text, offset)) {
    return null
  }

  if (isAgentMentionActive(text, offset)) {
    return null
  }

  if (partial.length >= 1 && isEmojiPickerActive(text, offset)) {
    return null
  }

  if (partial.length >= 1 && isTypingEmojiShortcode(text, offset)) {
    return null
  }

  if (partial.length >= 1) {
    const completedWords = extractCompletedWordsBefore(text, start, 4)
    const { bigramKey, trigramKey, fourgramKey } = buildContextKeys(completedWords)

    return {
      mode: 'prefix',
      prefix: partial,
      previousWords: completedWords,
      bigramKey,
      trigramKey,
      fourgramKey,
      from: parentStart + start,
      to: from,
    }
  }

  if (partial.length === 0 && afterBoundary) {
    const sentenceStart = isAtEmptyLineStart(text, offset) || isAfterSentenceBoundary(text, offset)
    const completedWords = sentenceStart ? [] : extractPreviousWords(text, offset)
    const { bigramKey, trigramKey, fourgramKey } = buildContextKeys(completedWords)

    return {
      mode: 'next-word',
      prefix: '',
      previousWords: completedWords,
      bigramKey,
      trigramKey,
      fourgramKey,
      from,
      to: from,
    }
  }

  return null
}

export function getTextblockTokens(state: EditorState): string[] {
  const ctx = getTextblockContext(state)
  if (!ctx) return []
  return ctx.text.match(WORD_TOKEN_RE) ?? []
}
