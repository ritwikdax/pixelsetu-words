import type { PredictionCandidate, PredictionSource } from '../workers/prediction.worker'

export interface DictionaryCandidate {
  word: string
  weight: number
}

export type MergedSource = PredictionSource | 'dictionary'

export interface RankedSuggestion {
  word: string
  score: number
  sources: MergedSource[]
}

export function mergePredictionResults(
  predictionCandidates: PredictionCandidate[],
  dictionaryWords: DictionaryCandidate[],
  options: {
    exclude?: string
    limit?: number
  } = {},
): RankedSuggestion[] {
  const { exclude, limit = 8 } = options
  const scores = new Map<string, { score: number; sources: Set<MergedSource> }>()

  for (const entry of predictionCandidates) {
    if (exclude && entry.word === exclude) continue
    const personalOnly = entry.sources.length === 1 && entry.sources[0] === 'personal'
    scores.set(entry.word, {
      score: personalOnly ? entry.score * 1.35 : entry.score,
      sources: new Set(entry.sources),
    })
  }

  for (const entry of dictionaryWords) {
    if (exclude && entry.word === exclude) continue
    const existing = scores.get(entry.word)
    const dictScore = entry.weight * 0.35
    if (existing) {
      existing.score += dictScore
      existing.sources.add('dictionary')
    } else {
      scores.set(entry.word, {
        score: dictScore,
        sources: new Set(['dictionary']),
      })
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, data]) => ({
      word,
      score: data.score,
      sources: [...data.sources],
    }))
}

/** @deprecated Use mergePredictionResults */
export function mergeSuggestions(
  dictionaryWords: DictionaryCandidate[],
  learnedWords: Array<{ word: string; score: number }>,
  options: {
    exclude?: string
    limit?: number
  } = {},
): { words: string[]; learned: Set<string> } {
  const learned = learnedWords.map((entry) => ({
    word: entry.word,
    score: entry.score * 100,
    sources: ['personal'] as PredictionSource[],
  }))

  const merged = mergePredictionResults(learned, dictionaryWords, options)
  const learnedSet = new Set(
    merged.filter((entry) => entry.sources.includes('personal')).map((entry) => entry.word),
  )

  return {
    words: merged.map((entry) => entry.word),
    learned: learnedSet,
  }
}
