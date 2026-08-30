import { useCallback, useRef } from 'react'
import {
  getLearnedSuccessors,
  learnBigramFromAccept,
  learnFromSequence,
  learnFromText,
  learnTransition,
  type ScoredWord,
  type SessionLearnEvent,
} from '../utils/wordMemory'

export function useWordMemory() {
  const lastLearnedRef = useRef({ key: '', at: 0 })
  const onSessionLearnRef = useRef<((events: SessionLearnEvent[]) => void) | null>(null)

  const notifySessionLearning = useCallback((events: SessionLearnEvent[]) => {
    const meaningful = events.filter((event) => event.score > 0)
    if (meaningful.length === 0) return
    onSessionLearnRef.current?.(meaningful)
  }, [])

  const registerSessionLearnHandler = useCallback(
    (handler: ((events: SessionLearnEvent[]) => void) | null) => {
      onSessionLearnRef.current = handler
    },
    [],
  )

  const learnFromAccept = useCallback(
    async (context: string | null, next: string) => {
      if (!context) return
      const event = await learnBigramFromAccept(context, next)
      notifySessionLearning([event])
    },
    [notifySessionLearning],
  )

  const learnEdge = useCallback(
    async (from: string, to: string) => {
      const key = `${from.toLowerCase()}=>${to.toLowerCase()}`
      const now = Date.now()
      if (lastLearnedRef.current.key === key && now - lastLearnedRef.current.at < 80) {
        return
      }
      lastLearnedRef.current = { key, at: now }
      const event = await learnTransition(from, to)
      notifySessionLearning([event])
    },
    [notifySessionLearning],
  )

  const learnFromSentence = useCallback(
    async (words: string[]) => {
      if (words.length < 1) return
      const key = words.join(' ')
      const now = Date.now()
      if (lastLearnedRef.current.key === `sentence:${key}` && now - lastLearnedRef.current.at < 250) {
        return
      }
      lastLearnedRef.current = { key: `sentence:${key}`, at: now }
      const events = await learnFromSequence(words)
      notifySessionLearning(events)
    },
    [notifySessionLearning],
  )

  const learnFromDocument = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const events = await learnFromText(text)
      notifySessionLearning(events)
    },
    [notifySessionLearning],
  )

  const getPredictions = useCallback(
    async (context: string | null, prefix = '', limit = 8): Promise<ScoredWord[]> => {
      if (!context) return []
      return getLearnedSuccessors(context, prefix, limit)
    },
    [],
  )

  return {
    learnFromAccept,
    learnEdge,
    learnFromSentence,
    learnFromDocument,
    registerSessionLearnHandler,
    getPredictions,
  }
}
