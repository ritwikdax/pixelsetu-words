/** Apply the casing pattern from the typed prefix onto a suggested word. */
export function applyPrefixCasing(prefix: string, word: string): string {
  const letters = prefix.replace(/[^a-zA-Z]/g, '')
  if (letters.length === 0) return word

  if (letters === letters.toUpperCase()) {
    return word.toUpperCase()
  }

  if (prefix[0] === prefix[0]?.toUpperCase()) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }

  return word.toLowerCase()
}

export function getSuggestionUi(context: {
  mode: 'prefix' | 'next-word'
  prefix: string
}): 'inline' | 'popover' {
  if (context.mode === 'next-word') return 'inline'
  return context.prefix.length >= 2 ? 'popover' : 'inline'
}

export function getInlineSuggestionSuffix(
  mode: 'prefix' | 'next-word',
  prefix: string,
  word: string,
): string {
  return getSuggestionRemainder(mode, prefix, word)
}

/** Letters to insert after the already typed prefix. Never rewrites typed text. */
export function getSuggestionRemainder(
  mode: 'prefix' | 'next-word',
  typedPrefix: string,
  suggestionWord: string,
): string {
  if (mode === 'next-word' || typedPrefix.length === 0) {
    return suggestionWord
  }

  if (!suggestionWord.toLowerCase().startsWith(typedPrefix.toLowerCase())) {
    return suggestionWord
  }

  return suggestionWord.slice(typedPrefix.length)
}

export function buildSuggestionInsertion(
  mode: 'prefix' | 'next-word',
  typedPrefix: string,
  suggestionWord: string,
  textAfterCursor: string,
): string {
  const remainder = getSuggestionRemainder(mode, typedPrefix, suggestionWord)
  if (!remainder) {
    return /^\s/.test(textAfterCursor) ? '' : ' '
  }

  const needsLeadingSpace =
    mode === 'prefix' &&
    typedPrefix.length > 0 &&
    !suggestionWord.toLowerCase().startsWith(typedPrefix.toLowerCase())

  const insertion = needsLeadingSpace ? ` ${remainder}` : remainder
  if (/^\s/.test(textAfterCursor) || insertion.endsWith(' ')) {
    return insertion
  }

  return `${insertion} `
}
