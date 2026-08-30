import { useId } from 'react'
import { getSuggestionRemainder } from '../utils/applySuggestionCasing'
import type { MergedSource, RankedSuggestion } from '../utils/suggestionMerge'

interface WordSuggestionsProps {
  open: boolean
  suggestions: RankedSuggestion[]
  selectedIndex: number
  prefix: string
  top: number
  left: number
  loading?: boolean
  mode?: 'prefix' | 'next-word'
}

const SOURCE_LABELS: Partial<Record<MergedSource, string>> = {
  personal: 'you',
  ml: 'ml',
}

const VISIBLE_SOURCE_PRIORITY: MergedSource[] = ['personal', 'ml']

function visibleSource(sources: MergedSource[]): MergedSource | null {
  for (const source of VISIBLE_SOURCE_PRIORITY) {
    if (sources.includes(source)) return source
  }
  return null
}

export function WordSuggestions({
  open,
  suggestions,
  selectedIndex,
  prefix,
  top,
  left,
  loading,
  mode = 'prefix',
}: WordSuggestionsProps) {
  const listboxId = useId()
  const activeOptionId =
    open && suggestions.length > 0 ? `${listboxId}-option-${selectedIndex}` : undefined

  if (!open) return null

  return (
    <div
      className="word-suggestions"
      style={{ top, left }}
      role="listbox"
      id={listboxId}
      aria-label="Word suggestions"
      aria-activedescendant={activeOptionId}
      aria-busy={loading || undefined}
    >
      {loading && suggestions.length === 0 ? (
        <div className="word-suggestion muted" role="status">
          Predicting…
        </div>
      ) : suggestions.length === 0 ? (
        <div className="word-suggestion muted" role="status">
          {mode === 'next-word' ? 'No predictions for this context' : `No matches for "${prefix}"`}
        </div>
      ) : (
        suggestions.map((entry, index) => {
          const active = index === selectedIndex
          const displayRemainder = getSuggestionRemainder(mode, prefix, entry.word)
          const source = visibleSource(entry.sources)
          const sourceLabel = source ? SOURCE_LABELS[source] : null

          return (
            <div
              key={`${entry.word}-${index}`}
              id={`${listboxId}-option-${index}`}
              className={`word-suggestion ${active ? 'active' : ''}`}
              role="option"
              aria-selected={active}
            >
              {prefix ? (
                <>
                  <span className="word-suggestion-prefix">{prefix}</span>
                  <span className="word-suggestion-suffix">{displayRemainder}</span>
                </>
              ) : (
                <span className="word-suggestion-suffix">{displayRemainder}</span>
              )}
              {sourceLabel && (
                <span
                  className={`word-suggestion-source source-${source}`}
                  aria-label={`source: ${sourceLabel}`}
                >
                  {sourceLabel}
                </span>
              )}
            </div>
          )
        })
      )}
      <div className="word-suggestions-hint" aria-hidden="true">
        {mode === 'next-word'
          ? '↑↓ navigate · Enter accept · ⌘/Ctrl+Enter new line'
          : '↑↓ navigate · Enter accept · ⌘/Ctrl+Enter new line · Esc dismiss'}
      </div>
    </div>
  )
}
