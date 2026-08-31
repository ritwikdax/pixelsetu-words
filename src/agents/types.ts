export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  host?: boolean
  once?: boolean
}

export interface AgentRunContext {
  documentContext?: string
  executeHostTool?: (name: string, params: Record<string, unknown>) => Promise<string>
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  systemPrompt: string
  tools: AgentTool[]
  executeTool: (
    name: string,
    params: Record<string, unknown>,
    context?: AgentRunContext,
  ) => Promise<string>
}

export interface AgentPlanAction {
  action: 'tool'
  tool: string
  params: Record<string, unknown>
  reasoning?: string
}

export interface AgentReplyAction {
  action: 'reply'
  text: string
}

export type AgentDecision = AgentPlanAction | AgentReplyAction

export interface AgentRunRequest {
  agentId: string
  prompt: string
  apiKey: string
  documentContext?: string
}

export interface AgentStreamCallbacks {
  onStatus?: (text: string) => void
  onChunk: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}
