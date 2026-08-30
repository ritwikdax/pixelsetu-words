import type { PredictionNgramPayload } from '../data/languageAssets'
import { grammarContinuations } from '../data/grammarRules'

export type PredictionSource = 'ngram' | 'trigram' | 'personal' | 'ml' | 'grammar'

export interface PredictionBootMessage {
  type: 'boot'
}

export interface PredictionInitMessage {
  type: 'init'
  data: PredictionNgramPayload
}

export interface PredictionRequest {
  id: number
  type: 'predict'
  mode: 'next-word' | 'prefix'
  prefix: string
  bigramKey: string | null
  trigramKey: string | null
  fourgramKey: string | null
  limit?: number
}

export interface SessionLearnMessage {
  type: 'session-learn'
  context: string
  next: string
  casing?: string
  score: number
}

export interface PredictionCandidate {
  word: string
  score: number
  sources: PredictionSource[]
}

export interface PredictionReadyMessage {
  type: 'ready'
  bigramContexts: number
  trigramContexts: number
}

export interface PredictionResponse {
  id: number
  type: 'results'
  candidates: PredictionCandidate[]
}

export interface PredictionErrorMessage {
  type: 'error'
  message: string
}

type WorkerRequest = PredictionInitMessage | PredictionRequest | SessionLearnMessage

type NgramData = PredictionNgramPayload

interface GraphEdge {
  weight: number
  casing: string
}

interface BigramRecord {
  context: string
  successors: Record<string, number | GraphEdge>
}

interface CandidateAccum {
  ngramScore: number
  trigramScore: number
  personalScore: number
  grammarScore: number
  display: string
  sources: Set<PredictionSource>
}

const DB_NAME = 'pixelsetu-word-memory'
const DB_VERSION = 1
const STORE = 'bigrams'
const DEFAULT_LIMIT = 8

let ngramData: NgramData = { bigrams: {}, trigrams: {}, unigrams: {} }
let dbPromise: Promise<IDBDatabase> | null = null
const sessionGraph = new Map<string, Record<string, GraphEdge>>()

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'context' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open word memory'))
  })

  return dbPromise
}

function normalizeContext(context: string): string {
  return context.replace(/\u2019/g, "'").toLowerCase().trim().replace(/\s+/g, ' ')
}

function asEdge(value: number | GraphEdge | undefined, fallbackCasing: string): GraphEdge {
  if (value == null) return { weight: 0, casing: fallbackCasing }
  if (typeof value === 'number') return { weight: value, casing: fallbackCasing }
  return { weight: value.weight, casing: value.casing || fallbackCasing }
}

function applySessionLearning(context: string, next: string, score: number, casing?: string) {
  const from = normalizeContext(context)
  const to = next.replace(/\u2019/g, "'").toLowerCase().trim()
  const display = (casing || next).trim()
  if (!from || !to) return

  const node = { ...(sessionGraph.get(from) ?? {}) }
  const previous = asEdge(node[to], display)
  node[to] = {
    weight: Math.max(previous.weight, score),
    casing: display || previous.casing || to,
  }
  sessionGraph.set(from, node)
}

async function getPersonalSuccessors(context: string): Promise<Record<string, GraphEdge>> {
  const from = normalizeContext(context)
  const session = sessionGraph.get(from) ?? {}
  const merged: Record<string, GraphEdge> = { ...session }

  try {
    const db = await openDb()
    if (!db.objectStoreNames.contains(STORE)) return merged

    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const request = store.get(from)
      request.onsuccess = () => {
        const record = request.result as BigramRecord | undefined
        const persisted = record?.successors ?? {}
        for (const [key, value] of Object.entries(persisted)) {
          const edge = asEdge(value, key)
          const current = merged[key]
          merged[key] = {
            weight: Math.max(current?.weight ?? 0, edge.weight),
            casing: current?.casing || edge.casing || key,
          }
        }
        resolve(merged)
      }
      request.onerror = () => resolve(merged)
    })
  } catch {
    return merged
  }
}

function scalePersonalScore(score: number): number {
  return score * (1 + Math.log1p(score) * 0.35)
}

function addToPool(
  pool: Map<string, CandidateAccum>,
  word: string,
  score: number,
  source: PredictionSource,
  field: keyof Pick<
    CandidateAccum,
    'ngramScore' | 'trigramScore' | 'personalScore' | 'grammarScore'
  >,
  scoreScale = 1,
) {
  if (!word || score <= 0) return
  const key = word.replace(/\u2019/g, "'").toLowerCase()
  const scaled = score * scoreScale
  const existing = pool.get(key) ?? {
    ngramScore: 0,
    trigramScore: 0,
    personalScore: 0,
    grammarScore: 0,
    display: word,
    sources: new Set<PredictionSource>(),
  }
  existing[field] = Math.max(existing[field], scaled)
  existing.sources.add(source)
  if (source === 'personal' && word !== key) {
    existing.display = word
  }
  pool.set(key, existing)
}

function matchesPrefix(word: string, prefix: string): boolean {
  return !prefix || word.toLowerCase().startsWith(prefix.toLowerCase())
}

function collectFromMap(
  pool: Map<string, CandidateAccum>,
  map: Record<string, number> | undefined,
  source: PredictionSource,
  field: keyof Pick<
    CandidateAccum,
    'ngramScore' | 'trigramScore' | 'personalScore' | 'grammarScore'
  >,
  prefix: string,
  scoreScale = 1,
) {
  if (!map) return
  for (const [word, score] of Object.entries(map)) {
    if (matchesPrefix(word, prefix)) {
      addToPool(pool, word, score, source, field, scoreScale)
    }
  }
}

function collectPersonalMap(
  pool: Map<string, CandidateAccum>,
  map: Record<string, GraphEdge>,
  prefix: string,
  scoreScale: number,
) {
  for (const [key, edge] of Object.entries(map)) {
    const display = edge.casing || key
    if (matchesPrefix(display, prefix)) {
      addToPool(pool, display, scalePersonalScore(edge.weight), 'personal', 'personalScore', scoreScale)
    }
  }
}

function collectPersonalContinuation(
  pool: Map<string, CandidateAccum>,
  map: Record<string, GraphEdge>,
  scoreScale: number,
) {
  for (const [key, edge] of Object.entries(map)) {
    addToPool(pool, edge.casing || key, scalePersonalScore(edge.weight), 'personal', 'personalScore', scoreScale)
  }
}

function collectGrammar(
  pool: Map<string, CandidateAccum>,
  bigramKey: string | null,
  trigramKey: string | null,
  prefix: string,
) {
  for (const { word, score } of grammarContinuations(bigramKey, trigramKey)) {
    if (matchesPrefix(word, prefix)) {
      addToPool(pool, word, score, 'grammar', 'grammarScore')
    }
  }
}

function hasContextualModel(
  bigramKey: string | null,
  trigramKey: string | null,
): boolean {
  return Boolean(
    (trigramKey && ngramData.trigrams[trigramKey]) ||
      (bigramKey && ngramData.bigrams[bigramKey]) ||
      grammarContinuations(bigramKey, trigramKey).length > 0,
  )
}

function sourceRank(sources: PredictionSource[]): number {
  if (sources.includes('personal')) return 2
  if (sources.includes('grammar')) return 1
  return 0
}

function rankPool(pool: Map<string, CandidateAccum>, limit: number): PredictionCandidate[] {
  const ranked = [...pool.values()]
    .map((accum) => {
      const personal = accum.personalScore > 0
      const grammar = accum.grammarScore > 0
      const base =
        accum.ngramScore * 1 +
        accum.trigramScore * 1.35 +
        accum.personalScore * 3.8 +
        accum.grammarScore * 2.2
      return {
        word: accum.display,
        score: personal ? base + 400 : grammar ? base + 180 : base,
        sources: [...accum.sources],
      }
    })
    .sort((a, b) => {
      const rankDiff = sourceRank(b.sources) - sourceRank(a.sources)
      if (rankDiff !== 0) return rankDiff
      return b.score - a.score || a.word.localeCompare(b.word)
    })

  return ranked.slice(0, limit)
}

async function predict(request: PredictionRequest): Promise<PredictionCandidate[]> {
  const { mode, prefix, bigramKey, trigramKey, fourgramKey, limit = DEFAULT_LIMIT } = request
  const normalizedPrefix = prefix.toLowerCase()
  const pool = new Map<string, CandidateAccum>()

  collectGrammar(pool, bigramKey, trigramKey, normalizedPrefix)

  if (trigramKey) {
    collectFromMap(pool, ngramData.trigrams[trigramKey], 'trigram', 'trigramScore', normalizedPrefix)
  }

  if (bigramKey) {
    collectFromMap(pool, ngramData.bigrams[bigramKey], 'ngram', 'ngramScore', normalizedPrefix)
  }

  if (fourgramKey) {
    const personalFourgram = await getPersonalSuccessors(fourgramKey)
    collectPersonalMap(pool, personalFourgram, normalizedPrefix, 1.55)
  }

  if (trigramKey) {
    const personalTrigram = await getPersonalSuccessors(trigramKey)
    collectPersonalMap(pool, personalTrigram, normalizedPrefix, 1.3)
  }

  if (bigramKey) {
    const personalBigram = await getPersonalSuccessors(bigramKey)
    collectPersonalMap(pool, personalBigram, normalizedPrefix, 1.1)
  }

  if (mode === 'prefix' && normalizedPrefix.length >= 1) {
    const continuation = await getPersonalSuccessors(normalizedPrefix)
    collectPersonalContinuation(pool, continuation, 1.65)
  }

  if (pool.size === 0 && !hasContextualModel(bigramKey, trigramKey)) {
    const startContinuation = await getPersonalSuccessors('^')
    if (mode === 'prefix' && normalizedPrefix.length >= 1) {
      collectPersonalMap(pool, startContinuation, normalizedPrefix, 1.2)
    } else if (mode === 'next-word') {
      collectPersonalContinuation(pool, startContinuation, 1.2)
    }
  }

  if (pool.size === 0 && !hasContextualModel(bigramKey, trigramKey)) {
    return []
  }

  if (mode === 'prefix' && normalizedPrefix.length >= 1 && pool.size === 0) {
    return []
  }

  return rankPool(pool, limit)
}

function loadNgrams(data: NgramData) {
  ngramData = {
    bigrams: data.bigrams ?? {},
    trigrams: data.trigrams ?? {},
    unigrams: data.unigrams ?? {},
  }

  const ready: PredictionReadyMessage = {
    type: 'ready',
    bigramContexts: Object.keys(ngramData.bigrams).length,
    trigramContexts: Object.keys(ngramData.trigrams).length,
  }
  self.postMessage(ready)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type === 'init') {
    try {
      loadNgrams(event.data.data)
    } catch (error) {
      const response: PredictionErrorMessage = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load prediction ngrams',
      }
      self.postMessage(response)
    }
    return
  }

  if (event.data.type === 'session-learn') {
    applySessionLearning(
      event.data.context,
      event.data.next,
      event.data.score,
      event.data.casing,
    )
    return
  }

  if (event.data.type !== 'predict') return

  const message = event.data
  predict(message)
    .then((candidates) => {
      const response: PredictionResponse = {
        id: message.id,
        type: 'results',
        candidates,
      }
      self.postMessage(response)
    })
    .catch((error: Error) => {
      const response: PredictionErrorMessage = {
        type: 'error',
        message: error.message,
      }
      self.postMessage(response)
    })
}

self.postMessage({ type: 'boot' } satisfies PredictionBootMessage)
