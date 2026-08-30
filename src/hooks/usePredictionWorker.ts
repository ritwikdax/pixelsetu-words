import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPredictionNgrams } from '../data/languageAssets'
import { getSuggestionUi } from '../utils/applySuggestionCasing'
import type { AnalyzedContext } from '../utils/contextAnalyzer'
import type { SessionLearnEvent } from '../utils/wordMemory'
import PredictionWorker from '../workers/prediction.worker.ts?worker'
import type {
  PredictionBootMessage,
  PredictionCandidate,
  PredictionErrorMessage,
  PredictionInitMessage,
  PredictionReadyMessage,
  PredictionResponse,
  SessionLearnMessage,
} from '../workers/prediction.worker'

type WorkerMessage =
  | PredictionBootMessage
  | PredictionReadyMessage
  | PredictionResponse
  | PredictionErrorMessage

function resolveAll(
  pending: Map<number, (results: PredictionCandidate[]) => void>,
  results: PredictionCandidate[] = [],
) {
  for (const resolve of pending.values()) resolve(results)
  pending.clear()
}

export function usePredictionWorker() {
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingRef = useRef(new Map<number, (results: PredictionCandidate[]) => void>())
  const debounceRef = useRef<number>()
  const debounceResolveRef = useRef<((results: PredictionCandidate[]) => void) | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new PredictionWorker()
    const abort = new AbortController()
    workerRef.current = worker
    setReady(false)

    const failPending = () => resolveAll(pendingRef.current)

    let booted = false
    let pendingInit: PredictionInitMessage | null = null

    const sendInit = (init: PredictionInitMessage) => {
      pendingInit = init
      if (booted && !abort.signal.aborted) {
        worker.postMessage(init)
      }
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data

      if (message.type === 'boot') {
        booted = true
        if (pendingInit && !abort.signal.aborted) {
          worker.postMessage(pendingInit)
        }
        return
      }

      if (message.type === 'ready') {
        setReady(true)
        return
      }

      if (message.type === 'error') {
        console.error('Prediction worker error:', message.message)
        setReady(true)
        failPending()
        return
      }

      const resolve = pendingRef.current.get(message.id)
      if (resolve) {
        pendingRef.current.delete(message.id)
        resolve(message.candidates)
      }
    }

    worker.onerror = (event) => {
      console.error('Prediction worker crashed:', event.message)
      setReady(true)
      failPending()
    }

    void fetchPredictionNgrams(abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return
        sendInit({ type: 'init', data })
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return
        console.error('Prediction ngrams download failed:', error)
        sendInit({
          type: 'init',
          data: { bigrams: {}, trigrams: {}, unigrams: {} },
        })
      })

    return () => {
      abort.abort()
      failPending()
      debounceResolveRef.current?.([])
      debounceResolveRef.current = null
      window.clearTimeout(debounceRef.current)
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const predict = useCallback(
    (context: AnalyzedContext, limit = 8): Promise<PredictionCandidate[]> => {
      return new Promise((resolve) => {
        const worker = workerRef.current
        if (!worker || !ready) {
          resolve([])
          return
        }

        const id = ++requestIdRef.current
        const timer = window.setTimeout(() => {
          if (pendingRef.current.delete(id)) resolve([])
        }, 4000)
        pendingRef.current.set(id, (results) => {
          window.clearTimeout(timer)
          resolve(results)
        })
        worker.postMessage({
          id,
          type: 'predict',
          mode: context.mode,
          channel: getSuggestionUi(context) === 'popover' ? 'popover' : 'ghost',
          prefix: context.prefix,
          bigramKey: context.bigramKey,
          trigramKey: context.trigramKey,
          fourgramKey: context.fourgramKey,
          sentenceTokens: context.sentenceTokens,
          limit,
        })
      })
    },
    [ready],
  )

  const predictDebounced = useCallback(
    (context: AnalyzedContext, limit = 8, delay = 45): Promise<PredictionCandidate[]> => {
      return new Promise((resolve) => {
        debounceResolveRef.current?.([])
        debounceResolveRef.current = resolve
        window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
          debounceResolveRef.current = null
          predict(context, limit).then(resolve)
        }, delay)
      })
    },
    [predict],
  )

  const cancelPending = useCallback(() => {
    window.clearTimeout(debounceRef.current)
    debounceResolveRef.current?.([])
    debounceResolveRef.current = null
    resolveAll(pendingRef.current)
  }, [])

  const pushSessionLearning = useCallback((events: SessionLearnEvent[]) => {
    const worker = workerRef.current
    if (!worker) return

    for (const event of events) {
      if (event.score <= 0) continue
      const message: SessionLearnMessage = {
        type: 'session-learn',
        context: event.context,
        next: event.next,
        casing: event.casing,
        score: event.score,
      }
      worker.postMessage(message)
    }
  }, [])

  return { ready, predict, predictDebounced, cancelPending, pushSessionLearning }
}
