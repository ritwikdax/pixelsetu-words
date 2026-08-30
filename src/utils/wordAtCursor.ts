import type { EditorState, Transaction } from '@tiptap/pm/state'
import { tokenizeWords } from './wordMemory'

const WORD_CHAR = /[A-Za-z\u00C0-\u024F'\u2019]/

export interface WordContext {
  word: string
  from: number
  to: number
}

export type SuggestionMode = 'prefix' | 'next-word'

export interface SuggestionContext {
  mode: SuggestionMode
  prefix: string
  previousWord: string | null
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

export function getPreviousWord(state: EditorState): string | null {
  const ctx = getTextblockContext(state)
  if (!ctx || ctx.offset === 0) return null

  let end = ctx.offset
  while (end > 0 && !WORD_CHAR.test(ctx.text[end - 1]!)) {
    end--
  }
  if (end === 0) return null

  let start = end
  while (start > 0 && WORD_CHAR.test(ctx.text[start - 1]!)) {
    start--
  }

  const word = ctx.text.slice(start, end)
  return word || null
}

export function getSuggestionContext(state: EditorState): SuggestionContext | null {
  const ctx = getTextblockContext(state)
  if (!ctx) return null

  const { from, parentStart, offset, text } = ctx
  const previousWord = getPreviousWord(state)

  let start = offset
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) {
    start--
  }

  const partial = text.slice(start, offset)
  const atWordStart = partial.length === 0
  const charBefore = offset > 0 ? text[offset - 1] : ''
  const afterBoundary = offset === 0 || !WORD_CHAR.test(charBefore)

  if (atWordStart && afterBoundary && previousWord) {
    return {
      mode: 'next-word',
      prefix: '',
      previousWord,
      from,
      to: from,
    }
  }

  if (partial.length >= 2) {
    return {
      mode: 'prefix',
      prefix: partial,
      previousWord,
      from: parentStart + start,
      to: from,
    }
  }

  if (partial.length === 1 && previousWord) {
    return {
      mode: 'prefix',
      prefix: partial,
      previousWord,
      from: parentStart + start,
      to: from,
    }
  }

  return null
}

export function getWordAtCursor(state: EditorState): WordContext | null {
  const suggestion = getSuggestionContext(state)
  if (!suggestion || suggestion.mode !== 'prefix' || suggestion.prefix.length < 2) {
    return null
  }

  return {
    word: suggestion.prefix,
    from: suggestion.from,
    to: suggestion.to,
  }
}

function extractWordBefore(text: string, position: number): { word: string; start: number } | null {
  let end = position
  while (end > 0 && !WORD_CHAR.test(text[end - 1]!)) {
    end--
  }
  if (end === 0) return null

  let start = end
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) {
    start--
  }

  const word = text.slice(start, end)
  return word ? { word, start } : null
}

export function getCompletedBigram(state: EditorState): { context: string; next: string } | null {
  const pairs = getCompletedNgrams(state)
  return pairs?.[0] ?? null
}

export function getCompletedNgrams(
  state: EditorState,
): Array<{ context: string; next: string }> | null {
  const ctx = getTextblockContext(state)
  if (!ctx || ctx.offset === 0) return null

  const { offset, text } = ctx
  if (text[offset - 1] !== ' ') return null

  const completed = extractWordBefore(text, offset - 1)
  if (!completed) return null

  const pairs: Array<{ context: string; next: string }> = []
  const prev = extractWordBefore(text, completed.start)
  if (prev) {
    pairs.push({ context: prev.word, next: completed.word })
    const prevPrev = extractWordBefore(text, prev.start)
    if (prevPrev) {
      pairs.push({ context: `${prevPrev.word} ${prev.word}`, next: completed.word })
      const prevPrevPrev = extractWordBefore(text, prevPrev.start)
      if (prevPrevPrev) {
        pairs.push({
          context: `${prevPrevPrev.word} ${prevPrev.word} ${prev.word}`,
          next: completed.word,
        })
      }
    }
  }

  return pairs.length > 0 ? pairs : null
}

const CLAUSE_END = /[.!?,;:]/

function tokenizePreservingCase(text: string): string[] {
  return tokenizeWords(text)
}

/**
 * Tokens of the clause/sentence that just ended: Enter, `.` `!` `?`, or `,` `;` `:`.
 */
export function getCompletedClauseTokens(state: EditorState): string[] | null {
  const { from } = state.selection
  if (!state.selection.empty) return null

  const $pos = state.doc.resolve(from)
  if ($pos.depth >= 1 && $pos.parent.isTextblock && $pos.parentOffset === 0) {
    const index = $pos.index($pos.depth - 1)
    if (index > 0) {
      const previous = $pos.node($pos.depth - 1).child(index - 1)
      if (previous.isTextblock) {
        const text = previous.textContent.trim()
        const tokens = tokenizePreservingCase(text)
        return tokens.length >= 1 ? tokens : null
      }
    }
  }

  const ctx = getTextblockContext(state)
  if (!ctx || ctx.offset < 1) return null

  const { text, offset } = ctx
  let end = -1
  const last = text[offset - 1]!

  if (last === '\n') {
    end = offset - 1
  } else if (CLAUSE_END.test(last)) {
    end = offset - 1
  } else if (offset > 1 && last === ' ' && CLAUSE_END.test(text[offset - 2]!)) {
    end = offset - 2
  }

  if (end < 0) return null

  let start = end
  while (start > 0) {
    const ch = text[start - 1]!
    if (ch === '\n' || CLAUSE_END.test(ch)) break
    start -= 1
  }

  const clause = text.slice(start, end).trim()
  const tokens = tokenizePreservingCase(clause)
  return tokens.length >= 1 ? tokens : null
}

/** Tokens for a sentence the user just finished (. ! ? or newline). */
export function getSentenceJustCompleted(state: EditorState): string[] | null {
  return getCompletedClauseTokens(state)
}

/** Tokens from the line the user just finished with Enter/newline. */
export function getLineJustCompleted(state: EditorState): string[] | null {
  const ctx = getTextblockContext(state)
  if (!ctx || ctx.offset < 1 || ctx.text[ctx.offset - 1] !== '\n') return null

  const { text, offset } = ctx
  const end = offset - 1
  let start = end
  while (start > 0 && text[start - 1] !== '\n') {
    start -= 1
  }

  const line = text.slice(start, end).trim()
  if (/[.!?]$/.test(line)) return null

  const tokens = tokenizePreservingCase(line)
  return tokens.length >= 2 ? tokens : null
}

/**
 * Tokens from the previous textblock after Enter splits a paragraph.
 * Skips blocks that already end with . ! ? — those were learned at the terminator.
 */
export function getParagraphJustCompleted(state: EditorState): string[] | null {
  const { from } = state.selection
  if (!state.selection.empty) return null

  const $pos = state.doc.resolve(from)
  if ($pos.depth < 1 || !$pos.parent.isTextblock || $pos.parentOffset !== 0) return null

  const index = $pos.index($pos.depth - 1)
  if (index <= 0) return null

  const previous = $pos.node($pos.depth - 1).child(index - 1)
  if (!previous.isTextblock) return null

  const text = previous.textContent.trim()
  if (!text || /[.!?]$/.test(text)) return null

  const tokens = tokenizePreservingCase(text)
  return tokens.length >= 2 ? tokens : null
}

/** True for inserts/splits (Enter, typing). False for backspace and other deletions. */
export function isSentenceLearningUpdate(tr: Transaction): boolean {
  return tr.docChanged && tr.doc.content.size >= tr.before.content.size
}
