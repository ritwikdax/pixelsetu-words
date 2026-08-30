/** Language-model assets hosted on ImageKit (not bundled in `public/`). */
export const DICTIONARY_URL =
  'https://ik.imagekit.io/pixelsetu/pixelsetu-write/dictionary.txt'

export const PREDICTION_NGRAMS_URL =
  'https://ik.imagekit.io/pixelsetu/pixelsetu-write/prediction-ngrams.json'

export interface PredictionNgramPayload {
  bigrams: Record<string, Record<string, number>>
  trigrams: Record<string, Record<string, number>>
  unigrams: Record<string, number>
}

const CACHE_NAME = 'pixelsetu-language-assets-v1'
const FETCH_TIMEOUT_MS = 25_000

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms)
  }
  return undefined
}

function mergeSignals(external: AbortSignal | undefined, timeout: AbortSignal | undefined) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    const signals = [external, timeout].filter((signal): signal is AbortSignal => Boolean(signal))
    if (signals.length === 0) return undefined
    if (signals.length === 1) return signals[0]
    return AbortSignal.any(signals)
  }
  return external ?? timeout
}

async function readCachedText(url: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(url)
    if (!cached?.ok) return null
    return cached.text()
  } catch {
    return null
  }
}

async function writeCachedResponse(url: string, response: Response) {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(url, response)
  } catch {
    // quota / private mode
  }
}

export async function fetchLanguageText(
  url: string,
  externalSignal?: AbortSignal,
): Promise<string> {
  const cached = await readCachedText(url)
  if (cached !== null) return cached

  const signal = mergeSignals(externalSignal, timeoutSignal(FETCH_TIMEOUT_MS))
  const response = await fetch(url, {
    signal,
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache',
  })
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }

  void writeCachedResponse(url, response.clone())
  return response.text()
}

export async function fetchPredictionNgrams(
  externalSignal?: AbortSignal,
): Promise<PredictionNgramPayload> {
  const text = await fetchLanguageText(PREDICTION_NGRAMS_URL, externalSignal)
  const parsed = JSON.parse(text) as PredictionNgramPayload
  return {
    bigrams: parsed.bigrams ?? {},
    trigrams: parsed.trigrams ?? {},
    unigrams: parsed.unigrams ?? {},
  }
}

export async function fetchDictionaryText(externalSignal?: AbortSignal): Promise<string> {
  return fetchLanguageText(DICTIONARY_URL, externalSignal)
}
