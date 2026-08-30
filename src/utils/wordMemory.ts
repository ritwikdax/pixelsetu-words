const DB_NAME = 'pixelsetu-word-memory'
const DB_VERSION = 1
const STORE = 'bigrams'
const MAX_EDGES_PER_NODE = 64

export const START_CONTEXT = '^'

export const TYPING_BOOST = 1
export const ACCEPT_BOOST = 3

/** Word tokens keeping the user's casing, including contractions like I'm. */
export const WORD_TOKEN_RE = /[A-Za-z\u00C0-\u024F]+(?:['\u2019][A-Za-z]+)?/g

export interface GraphEdge {
  weight: number
  casing: string
}

export interface BigramRecord {
  context: string
  successors: Record<string, number | GraphEdge>
  updatedAt: number
  timesCompleted?: number
}

export interface ScoredWord {
  word: string
  score: number
  learned: boolean
}

export interface SessionLearnEvent {
  context: string
  next: string
  casing: string
  score: number
}

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

export function normalizeWord(word: string): string {
  return word.replace(/\u2019/g, "'").toLowerCase().trim()
}

export function normalizeContext(context: string): string {
  return normalizeWord(context).replace(/\s+/g, ' ')
}

export function asEdge(value: number | GraphEdge | undefined, fallbackCasing = ''): GraphEdge {
  if (value == null) return { weight: 0, casing: fallbackCasing }
  if (typeof value === 'number') return { weight: value, casing: fallbackCasing }
  return {
    weight: value.weight,
    casing: value.casing || fallbackCasing,
  }
}

export function tokenizeWords(text: string): string[] {
  const matches = stripMarkup(text).match(WORD_TOKEN_RE)
  return matches ?? []
}

function stripMarkup(text: string): string {
  if (!text.includes('<')) return text
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
}

function pruneEdges(edges: Record<string, GraphEdge>): Record<string, GraphEdge> {
  const entries = Object.entries(edges).sort((a, b) => b[1].weight - a[1].weight)
  if (entries.length <= MAX_EDGES_PER_NODE) return Object.fromEntries(entries)
  return Object.fromEntries(entries.slice(0, MAX_EDGES_PER_NODE))
}

async function getRecord(context: string): Promise<BigramRecord | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const request = store.get(normalizeContext(context))
    request.onsuccess = () => resolve((request.result as BigramRecord | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Failed to read word graph'))
  })
}

async function putRecord(record: BigramRecord): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write word graph'))
  })
}

/** Traverse context → next: increment edge weight and remember display casing. */
export async function learnTransition(
  context: string,
  next: string,
  boost = TYPING_BOOST,
  options: { additive?: boolean } = {},
): Promise<SessionLearnEvent> {
  const additive = options.additive !== false
  const from = context.trim() === '' ? START_CONTEXT : normalizeContext(context)
  const casing = next.trim()
  const to = normalizeWord(casing)

  if (!from || !to) {
    return { context: from, next: to, casing, score: 0 }
  }

  const node = { ...(sessionGraph.get(from) ?? {}) }
  const previousSession = asEdge(node[to], casing)
  const sessionEdge: GraphEdge = {
    weight: additive ? previousSession.weight + boost : Math.max(previousSession.weight, boost),
    casing: casing || previousSession.casing || to,
  }
  node[to] = sessionEdge
  sessionGraph.set(from, node)

  const existing = (await getRecord(from)) ?? {
    context: from,
    successors: {},
    updatedAt: Date.now(),
    timesCompleted: 0,
  }

  const persisted = asEdge(existing.successors[to], casing)
  existing.successors[to] = {
    weight: additive ? persisted.weight + boost : Math.max(persisted.weight, boost),
    casing: sessionEdge.casing,
  }
  existing.successors = pruneEdges(
    Object.fromEntries(
      Object.entries(existing.successors).map(([key, value]) => [key, asEdge(value, key)]),
    ),
  )
  existing.updatedAt = Date.now()
  existing.timesCompleted = (existing.timesCompleted ?? 0) + (additive ? 1 : 0)
  await putRecord(existing)

  return { context: from, next: to, casing: sessionEdge.casing, score: sessionEdge.weight }
}

export async function learnBigram(
  context: string,
  next: string,
  boost = TYPING_BOOST,
): Promise<SessionLearnEvent> {
  return learnTransition(context, next, boost)
}

export async function learnBigramFromAccept(context: string, next: string): Promise<SessionLearnEvent> {
  return learnTransition(context, next, ACCEPT_BOOST)
}

export function applySessionLearning(
  context: string,
  next: string,
  boost: number,
): SessionLearnEvent {
  const from = normalizeContext(context)
  const casing = next.trim()
  const to = normalizeWord(casing)
  if (!from || !to) return { context: from, next: to, casing, score: 0 }
  const node = { ...(sessionGraph.get(from) ?? {}) }
  const previous = asEdge(node[to], casing)
  const edge: GraphEdge = {
    weight: previous.weight + boost,
    casing: casing || previous.casing || to,
  }
  node[to] = edge
  sessionGraph.set(from, node)
  return { context: from, next: to, casing: edge.casing, score: edge.weight }
}

export function getSessionSuccessors(context: string): Record<string, GraphEdge> {
  return { ...(sessionGraph.get(normalizeContext(context)) ?? {}) }
}

export async function getLearnedSuccessors(
  context: string,
  prefix = '',
  limit = 8,
): Promise<ScoredWord[]> {
  const from = normalizeContext(context)
  const record = await getRecord(from)
  const merged: Record<string, GraphEdge> = {}

  for (const [key, value] of Object.entries(record?.successors ?? {})) {
    merged[key] = asEdge(value, key)
  }
  for (const [key, edge] of Object.entries(getSessionSuccessors(from))) {
    const current = merged[key]
    merged[key] = {
      weight: Math.max(current?.weight ?? 0, edge.weight),
      casing: edge.casing || current?.casing || key,
    }
  }

  const normalizedPrefix = prefix.toLowerCase()
  return Object.entries(merged)
    .filter(([key, edge]) => {
      const display = edge.casing || key
      return !normalizedPrefix || display.toLowerCase().startsWith(normalizedPrefix)
    })
    .map(([key, edge]) => ({
      word: edge.casing || key,
      score: edge.weight,
      learned: true,
    }))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .slice(0, limit)
}

export async function exportWordMemory(): Promise<BigramRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result as BigramRecord[])
    request.onerror = () => reject(request.error ?? new Error('Failed to export word memory'))
  })
}

export async function importWordMemory(records: BigramRecord[]): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const record of records) store.put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to import word memory'))
  })
}

export async function clearWordMemory(): Promise<void> {
  sessionGraph.clear()
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const request = tx.objectStore(STORE).clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to clear word memory'))
  })
}

/** Walk tokens as a path: each word is a state, each pair is a weighted edge. */
export async function learnFromSequence(
  words: string[],
  boost = TYPING_BOOST,
  options: { additive?: boolean } = {},
): Promise<SessionLearnEvent[]> {
  const tokens = words.map((word) => word.trim()).filter(Boolean)
  const events: SessionLearnEvent[] = []
  if (tokens.length === 0) return events

  events.push(await learnTransition(START_CONTEXT, tokens[0]!, boost, options))
  for (let index = 1; index < tokens.length; index += 1) {
    events.push(await learnTransition(tokens[index - 1]!, tokens[index]!, boost, options))
  }
  return events
}

export async function learnFromText(text: string, boost = TYPING_BOOST): Promise<SessionLearnEvent[]> {
  return learnFromSequence(tokenizeWords(text), boost, { additive: false })
}

export function scalePersonalScore(score: number): number {
  return score * (1 + Math.log1p(score) * 0.35)
}
