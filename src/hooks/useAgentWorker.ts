import { useCallback, useEffect, useRef } from 'react'
import AgentWorker from '../workers/agent.worker.ts?worker'
import type {
  AgentHostToolResultMessage,
  AgentWorkerRequest,
  AgentWorkerResponse,
} from '../workers/agent.worker'

export interface AgentRunCallbacks {
  onStatus?: (text: string) => void
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  onHostTool?: (name: string, params: Record<string, unknown>) => Promise<string>
}

export function useAgentWorker() {
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const activeRunsRef = useRef(new Map<number, AgentRunCallbacks>())

  useEffect(() => {
    const worker = new AgentWorker()
    workerRef.current = worker

    worker.onmessage = (event: MessageEvent<AgentWorkerResponse>) => {
      const message = event.data

      if (message.type === 'hostTool') {
        const callbacks = activeRunsRef.current.get(message.id)
        const reply = (payload: Omit<AgentHostToolResultMessage, 'type'>) => {
          const resultMessage: AgentHostToolResultMessage = {
            type: 'hostToolResult',
            ...payload,
          }
          worker.postMessage(resultMessage satisfies AgentWorkerRequest)
        }

        if (!callbacks?.onHostTool) {
          reply({ requestId: message.requestId, error: 'Note tools are unavailable' })
          return
        }

        void callbacks
          .onHostTool(message.name, message.params)
          .then((result) => reply({ requestId: message.requestId, result }))
          .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Note tool failed'
            reply({ requestId: message.requestId, error: errorMessage })
          })
        return
      }

      const callbacks = activeRunsRef.current.get(message.id)
      if (!callbacks) return

      switch (message.type) {
        case 'status':
          callbacks.onStatus?.(message.text)
          break
        case 'chunk':
          callbacks.onChunk(message.text)
          break
        case 'done':
          activeRunsRef.current.delete(message.id)
          callbacks.onDone()
          break
        case 'error':
          activeRunsRef.current.delete(message.id)
          callbacks.onError(message.message)
          break
      }
    }

    return () => {
      for (const id of activeRunsRef.current.keys()) {
        worker.postMessage({ type: 'abort', id } satisfies AgentWorkerRequest)
      }
      activeRunsRef.current.clear()
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const runAgent = useCallback(
    (
      agentId: string,
      prompt: string,
      apiKey: string,
      callbacks: AgentRunCallbacks,
      documentContext?: string,
    ): number => {
      const worker = workerRef.current
      if (!worker) {
        callbacks.onError('Agent worker not available')
        return -1
      }

      const id = ++requestIdRef.current
      activeRunsRef.current.set(id, callbacks)

      const message: AgentWorkerRequest = {
        type: 'run',
        id,
        agentId,
        prompt,
        apiKey,
        documentContext,
      }
      worker.postMessage(message)
      return id
    },
    [],
  )

  const abortAgent = useCallback((id: number) => {
    const worker = workerRef.current
    if (!worker) return
    worker.postMessage({ type: 'abort', id } satisfies AgentWorkerRequest)
    activeRunsRef.current.delete(id)
  }, [])

  return { runAgent, abortAgent }
}
