import { getAgent } from '../agents/registry'
import type { AgentRunContext, AgentStreamCallbacks } from '../agents/types'
import { planNextStep, streamReply } from './gemini'

const MAX_ITERATIONS = 10

function summarizeParams(params: Record<string, unknown>): string {
  const values = Object.values(params)
    .map((value) => {
      if (typeof value === 'string') return value.trim().slice(0, 80)
      if (Array.isArray(value)) return `${value.length} items`
      return String(value ?? '').trim()
    })
    .filter(Boolean)
  return values.join(', ')
}

export async function runAgentHarness(
  agentId: string,
  prompt: string,
  apiKey: string,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
  runContext?: AgentRunContext,
): Promise<void> {
  const agent = getAgent(agentId)
  if (!agent) {
    callbacks.onError(`Unknown agent: @${agentId}`)
    return
  }

  if (!apiKey) {
    callbacks.onError('Gemini API key not set. Run: gemini --set-key')
    return
  }

  const toolResults: string[] = []
  let documentContext = runContext?.documentContext

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (signal?.aborted) {
        callbacks.onError('Agent run cancelled')
        return
      }

      callbacks.onStatus?.(i === 0 ? 'Thinking…' : `Planning next step (${i + 1})…`)
      const decision = await planNextStep(
        apiKey,
        agent,
        prompt,
        toolResults,
        signal,
        documentContext,
      )

      if (decision.action === 'reply') {
        callbacks.onStatus?.('Writing…')
        await streamReply(
          apiKey,
          agent,
          prompt,
          toolResults,
          callbacks.onChunk,
          signal,
          documentContext,
        )
        callbacks.onDone()
        return
      }

      const toolName = decision.tool
      const knownTool = agent.tools.find((t) => t.name === toolName)
      if (!knownTool) {
        toolResults.push(`Error: unknown tool "${toolName}"`)
        callbacks.onStatus?.(`Unknown tool “${toolName}”, retrying…`)
        continue
      }

      if (decision.reasoning?.trim()) {
        callbacks.onStatus?.(decision.reasoning.trim())
      }

      const paramSummary = summarizeParams(decision.params ?? {})
      callbacks.onStatus?.(
        paramSummary ? `Running ${toolName} (${paramSummary})…` : `Running ${toolName}…`,
      )

      try {
        let result: string
        if (knownTool.host) {
          if (!runContext?.executeHostTool) {
            throw new Error('This tool can only run inside the editor')
          }
          result = await runContext.executeHostTool(toolName, decision.params ?? {})
          documentContext = result
        } else {
          result = await agent.executeTool(toolName, decision.params ?? {}, runContext)
        }
        toolResults.push(`${toolName}: ${result}`)
        callbacks.onStatus?.(`Got ${toolName} result`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed'
        toolResults.push(`${toolName} error: ${message}`)
        callbacks.onStatus?.(`${toolName} failed: ${message}`)
      }
    }

    callbacks.onStatus?.('Writing…')
    await streamReply(
      apiKey,
      agent,
      prompt,
      toolResults,
      callbacks.onChunk,
      signal,
      documentContext,
    )
    callbacks.onDone()
  } catch (error) {
    if (signal?.aborted) {
      callbacks.onError('Agent run cancelled')
      return
    }
    const message = error instanceof Error ? error.message : 'Agent run failed'
    callbacks.onError(message)
  }
}
