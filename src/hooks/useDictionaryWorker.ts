import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDictionaryText } from '../data/languageAssets'
import DictionaryWorker from '../workers/dictionary.worker.ts?worker'
import type {
  DictionaryBootMessage,
  DictionaryErrorMessage,
  DictionaryInitMessage,
  DictionaryReadyMessage,
  DictionarySearchResponse,
} from '../workers/dictionary.worker'
import type { DictionaryCandidate } from '../utils/suggestionMerge'

type WorkerMessage =
  | DictionaryBootMessage
  | DictionaryReadyMessage
  | DictionarySearchResponse
  | DictionaryErrorMessage

function resolveAll(
  pending: Map<number, (results: DictionaryCandidate[]) => void>,
  results: DictionaryCandidate[] = [],
) {
  for (const resolve of pending.values()) resolve(results)
  pending.clear()
}

export function useDictionaryWorker() {
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const pendingRef = useRef(new Map<number, (results: DictionaryCandidate[]) => void>())
  const debounceRef = useRef<number>()
  const debounceResolveRef = useRef<((results: DictionaryCandidate[]) => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    const worker = new DictionaryWorker()
    const abort = new AbortController()
    workerRef.current = worker
    setReady(false)

    const failPending = () => resolveAll(pendingRef.current)

    let booted = false
    let pendingInit: DictionaryInitMessage | null = null

    const sendInit = (init: DictionaryInitMessage) => {
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
        setWordCount(message.count)
        return
      }

      if (message.type === 'error') {
        console.error('Dictionary worker error:', message.message)
        setReady(true)
        failPending()
        return
      }

      const resolve = pendingRef.current.get(message.id)
      if (resolve) {
        pendingRef.current.delete(message.id)
        resolve(
          message.results.map((word, index) => ({
            word,
            weight: message.weights[index] ?? 1,
          })),
        )
      }
    }

    worker.onerror = (event) => {
      console.error('Dictionary worker crashed:', event.message)
      setReady(true)
      failPending()
    }

    void fetchDictionaryText(abort.signal)
      .then((text) => {
        if (abort.signal.aborted) return
        const init: DictionaryInitMessage = { type: 'init', text }
        sendInit(init)
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted) return
        console.error('Dictionary download failed:', error)
        sendInit({ type: 'init', text: '' })
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

  const search = useCallback((prefix: string, limit = 8): Promise<DictionaryCandidate[]> => {
    return new Promise((resolve) => {
      const worker = workerRef.current
      if (!worker || !ready || prefix.length < 2) {
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
      worker.postMessage({ id, type: 'search', prefix, limit })
    })
  }, [ready])

  const searchDebounced = useCallback(
    (prefix: string, limit = 8, delay = 80): Promise<DictionaryCandidate[]> => {
      return new Promise((resolve) => {
        debounceResolveRef.current?.([])
        debounceResolveRef.current = resolve
        window.clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
          debounceResolveRef.current = null
          search(prefix, limit).then(resolve)
        }, delay)
      })
    },
    [search],
  )

  return { ready, wordCount, search, searchDebounced }
}
