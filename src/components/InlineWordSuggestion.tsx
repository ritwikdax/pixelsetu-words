import { getSuggestionRemainder } from '../utils/applySuggestionCasing'
import type { RankedSuggestion } from '../utils/suggestionMerge'

interface InlineWordSuggestionProps {
  open: boolean
  loading?: boolean
  suggestions: RankedSuggestion[]
  selectedIndex: number
  prefix: string
  mode: 'prefix' | 'next-word'
  top: number
  left: number
  lineHeight: number
}

export function InlineWordSuggestion({
  open,
  loading,
  suggestions,
  selectedIndex,
  prefix,
  mode,
  top,
  left,
  lineHeight,
}: InlineWordSuggestionProps) {
  if (!open) return null
  if (loading && suggestions.length === 0) return null

  const entry = suggestions[selectedIndex] ?? suggestions[0]
  if (!entry) return null

  const suffix = getSuggestionRemainder(mode, prefix, entry.word)
  if (!suffix) return null

  return (
    <span
      className="inline-word-suggestion"
      style={{
        top,
        left,
        height: lineHeight > 0 ? lineHeight : undefined,
        lineHeight: lineHeight > 0 ? `${lineHeight}px` : undefined,
      }}
      aria-hidden="true"
    >
      {suffix}
    </span>
  )
}
