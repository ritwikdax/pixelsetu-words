import type { AgentDecision, AgentDefinition } from '../agents/types'

export const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
    }
  }[]
  error?: { message?: string }
}

function buildToolsPrompt(agent: AgentDefinition): string {
  const tools = agent.tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([key, value]) => `  - ${key} (${value.type}): ${value.description}`)
        .join('\n')
      return `- ${tool.name}: ${tool.description}\n${params}`
    })
    .join('\n')

  return tools
}

function buildPlanningPrompt(
  agent: AgentDefinition,
  userPrompt: string,
  toolResults: string[],
  documentContext?: string,
): string {
  const history =
    toolResults.length > 0
      ? `\n\nTool results so far:\n${toolResults.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : ''

  const note =
    documentContext?.trim()
      ? `\n\nCurrent notebook page (the user may refer to this existing note):\n${documentContext}`
      : ''

  return [
    agent.systemPrompt,
    '',
    'Available tools:',
    buildToolsPrompt(agent),
    '',
    'Respond with ONLY valid JSON (no markdown fences). Use one of:',
    '{"action":"tool","tool":"<name>","params":{...},"reasoning":"..."}',
    '{"action":"reply","text":"<final answer>"}',
    'Do not call a tool again after it succeeded. Prefer reply once you have a result.',
    '',
    `User request: ${userPrompt}${note}${history}`,
  ].join('\n')
}

function parseDecision(text: string): AgentDecision {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { action: 'reply', text: trimmed }
  }

  const parsed = JSON.parse(jsonMatch[0]) as AgentDecision
  if (parsed.action === 'tool' && parsed.tool) {
    return {
      action: 'tool',
      tool: parsed.tool,
      params: parsed.params ?? {},
      reasoning: parsed.reasoning,
    }
  }
  if (parsed.action === 'reply' && parsed.text) {
    return { action: 'reply', text: parsed.text }
  }

  return { action: 'reply', text: trimmed }
}

export async function planNextStep(
  apiKey: string,
  agent: AgentDefinition,
  userPrompt: string,
  toolResults: string[],
  signal?: AbortSignal,
  documentContext?: string,
): Promise<AgentDecision> {
  const prompt = buildPlanningPrompt(agent, userPrompt, toolResults, documentContext)

  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
    }),
    signal,
  })

  const data = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API error (${response.status})`)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) {
    throw new Error('Empty response from Gemini')
  }

  return parseDecision(text)
}

export async function streamReply(
  apiKey: string,
  agent: AgentDefinition,
  userPrompt: string,
  toolResults: string[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  documentContext?: string,
): Promise<void> {
  const history =
    toolResults.length > 0
      ? `\n\nTool results:\n${toolResults.join('\n\n')}`
      : ''

  const note =
    documentContext?.trim()
      ? `\n\nNotebook page:\n${documentContext}`
      : ''

  const prompt = [
    agent.systemPrompt,
    '',
    'Write a clear, helpful final answer for the user based on the tool results.',
    'If you already edited the notebook with note tools, give a short confirmation instead of repeating the inserted content.',
    `User request: ${userPrompt}${note}${history}`,
  ].join('\n')

  const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

  const response = await fetch(streamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    }),
    signal,
  })

  if (!response.ok) {
    const data = (await response.json()) as GeminiResponse
    throw new Error(data.error?.message ?? `Gemini stream error (${response.status})`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming not supported')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const event = JSON.parse(payload) as GeminiResponse
        const text = event.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onChunk(text)
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}
