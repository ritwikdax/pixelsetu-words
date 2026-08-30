import { getAgent } from '../agents/registry'
import { runAgentHarness } from '../runtime/harness'

export interface AgentRunMessage {
  type: 'run'
  id: number
  agentId: string
  prompt: string
  apiKey: string
  documentContext?: string
}

export interface AgentAbortMessage {
  type: 'abort'
  id: number
}

export interface AgentHostToolResultMessage {
  type: 'hostToolResult'
  requestId: number
  result?: string
  error?: string
}

export type AgentWorkerRequest = AgentRunMessage | AgentAbortMessage | AgentHostToolResultMessage

export interface AgentStatusMessage {
  type: 'status'
  id: number
  text: string
}

export interface AgentChunkMessage {
  type: 'chunk'
  id: number
  text: string
}

export interface AgentDoneMessage {
  type: 'done'
  id: number
}

export interface AgentErrorMessage {
  type: 'error'
  id: number
  message: string
}

export interface AgentHostToolMessage {
  type: 'hostTool'
  id: number
  requestId: number
  name: string
  params: Record<string, unknown>
}

export type AgentWorkerResponse =
  | AgentStatusMessage
  | AgentChunkMessage
  | AgentDoneMessage
  | AgentErrorMessage
  | AgentHostToolMessage

const abortControllers = new Map<number, AbortController>()
const pendingHostTools = new Map<number, { resolve: (value: string) => void; reject: (error: Error) => void }>()
let hostRequestSeq = 0

function requestHostTool(
  runId: number,
  name: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestId = ++hostRequestSeq
    pendingHostTools.set(requestId, { resolve, reject })

    const onAbort = () => {
      pendingHostTools.delete(requestId)
      reject(new Error('Agent run cancelled'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const response: AgentHostToolMessage = {
      type: 'hostTool',
      id: runId,
      requestId,
      name,
      params,
    }
    self.postMessage(response)
  })
}

self.onmessage = (event: MessageEvent<AgentWorkerRequest>) => {
  const message = event.data

  if (message.type === 'hostToolResult') {
    const pending = pendingHostTools.get(message.requestId)
    if (!pending) return
    pendingHostTools.delete(message.requestId)
    if (message.error) {
      pending.reject(new Error(message.error))
      return
    }
    pending.resolve(message.result ?? '')
    return
  }

  if (message.type === 'abort') {
    abortControllers.get(message.id)?.abort()
    abortControllers.delete(message.id)
    return
  }

  if (message.type === 'run') {
    const { id, agentId, prompt, apiKey, documentContext } = message

    if (!getAgent(agentId)) {
      const response: AgentErrorMessage = {
        type: 'error',
        id,
        message: `Unknown agent: @${agentId}`,
      }
      self.postMessage(response)
      return
    }

    const controller = new AbortController()
    abortControllers.set(id, controller)

    void runAgentHarness(
      agentId,
      prompt,
      apiKey,
      {
        onStatus: (text: string) => {
          const response: AgentStatusMessage = { type: 'status', id, text }
          self.postMessage(response)
        },
        onChunk: (text: string) => {
          const response: AgentChunkMessage = { type: 'chunk', id, text }
          self.postMessage(response)
        },
        onDone: () => {
          abortControllers.delete(id)
          const response: AgentDoneMessage = { type: 'done', id }
          self.postMessage(response)
        },
        onError: (errorMessage: string) => {
          abortControllers.delete(id)
          const response: AgentErrorMessage = { type: 'error', id, message: errorMessage }
          self.postMessage(response)
        },
      },
      controller.signal,
      {
        documentContext,
        executeHostTool: (name, params) => requestHostTool(id, name, params, controller.signal),
      },
    )
  }
}
