export interface DictionaryBootMessage {
  type: 'boot'
}

export interface DictionaryInitMessage {
  type: 'init'
  text: string
}

export interface DictionarySearchRequest {
  id: number
  type: 'search'
  prefix: string
  limit?: number
}

export interface DictionaryReadyMessage {
  type: 'ready'
  count: number
}

export interface DictionarySearchResponse {
  id: number
  type: 'results'
  prefix: string
  results: string[]
  weights: number[]
}

export interface DictionaryErrorMessage {
  type: 'error'
  message: string
}

type WorkerRequest = DictionaryInitMessage | DictionarySearchRequest

const PREFIX_BUCKET_LEN = 2
const DEFAULT_LIMIT = 8
const MAX_MATCHES_SCAN = 2000
const DEFAULT_WEIGHT = 1

interface CachedSearch {
  results: string[]
  resultWeights: number[]
}

let words: string[] = []
let weights: number[] = []
const prefixIndex = new Map<string, [number, number]>()
const cache = new Map<string, CachedSearch>()

function buildPrefixIndex(sorted: string[]) {
  for (let i = 0; i < sorted.length; i++) {
    const bucket = sorted[i]!.slice(0, PREFIX_BUCKET_LEN)
    if (!prefixIndex.has(bucket)) {
      prefixIndex.set(bucket, [i, i])
      continue
    }
    const range = prefixIndex.get(bucket)!
    range[1] = i
  }
}

function lowerBound(arr: string[], target: string, lo: number, hi: number): number {
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid]! < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

function compareByWeight(aIndex: number, bIndex: number) {
  const weightDiff = weights[bIndex]! - weights[aIndex]!
  if (weightDiff !== 0) return weightDiff
  return words[aIndex]!.localeCompare(words[bIndex]!)
}

function search(prefix: string, limit = DEFAULT_LIMIT): { results: string[]; weights: number[] } {
  const normalized = prefix.toLowerCase()
  if (normalized.length < 2) return { results: [], weights: [] }

  const cached = cache.get(normalized)
  if (cached) {
    return {
      results: cached.results.slice(0, limit),
      weights: cached.resultWeights.slice(0, limit),
    }
  }

  let lo = 0
  let hi = words.length

  if (normalized.length >= PREFIX_BUCKET_LEN) {
    const bucket = normalized.slice(0, PREFIX_BUCKET_LEN)
    const range = prefixIndex.get(bucket)
    if (!range) return { results: [], weights: [] }
    lo = range[0]
    hi = range[1] + 1
  }

  const start = lowerBound(words, normalized, lo, hi)
  const matchIndices: number[] = []

  for (let i = start; i < hi && matchIndices.length < MAX_MATCHES_SCAN; i++) {
    if (!words[i]!.startsWith(normalized)) break
    matchIndices.push(i)
  }

  matchIndices.sort(compareByWeight)
  const results = matchIndices.map((i) => words[i]!)
  const resultWeights = matchIndices.map((i) => weights[i] ?? DEFAULT_WEIGHT)

  if (cache.size > 500) {
    cache.clear()
  }
  cache.set(normalized, { results, resultWeights })

  return {
    results: results.slice(0, limit),
    weights: resultWeights.slice(0, limit),
  }
}

function parseDictionaryLine(line: string): { word: string; weight: number } | null {
  if (!line) return null
  const tab = line.indexOf('\t')
  if (tab === -1) return { word: line, weight: DEFAULT_WEIGHT }
  return {
    word: line.slice(0, tab),
    weight: Number(line.slice(tab + 1)) || DEFAULT_WEIGHT,
  }
}

function loadDictionary(text: string) {
  prefixIndex.clear()
  cache.clear()
  const parsed = text.split('\n').map(parseDictionaryLine).filter(Boolean) as {
    word: string
    weight: number
  }[]

  words = parsed.map((entry) => entry.word)
  weights = parsed.map((entry) => entry.weight)
  buildPrefixIndex(words)

  const ready: DictionaryReadyMessage = { type: 'ready', count: words.length }
  self.postMessage(ready)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      loadDictionary(message.text)
    } catch (error) {
      const response: DictionaryErrorMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to parse dictionary',
      }
      self.postMessage(response)
    }
    return
  }

  if (message.type !== 'search') return

  const { results, weights: resultWeights } = search(message.prefix, message.limit ?? DEFAULT_LIMIT)
  const response: DictionarySearchResponse = {
    id: message.id,
    type: 'results',
    prefix: message.prefix,
    results,
    weights: resultWeights,
  }
  self.postMessage(response)
}

self.postMessage({ type: 'boot' } satisfies DictionaryBootMessage)
