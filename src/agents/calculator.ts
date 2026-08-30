import type { AgentDefinition } from './types'

export function safeEvaluate(expression: string): number {
  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '').trim()
  if (!sanitized) {
    throw new Error('Invalid expression')
  }
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${sanitized})`)()
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number')
  }
  return result
}

export const calculatorAgent: AgentDefinition = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Evaluate math expressions',
  systemPrompt:
    'You are a calculator assistant. Use the calculate tool for arithmetic. ' +
    'Parse the user request into a valid math expression.',
  tools: [
    {
      name: 'calculate',
      description: 'Evaluate a math expression',
      parameters: {
        expression: { type: 'string', description: 'Math expression to evaluate', required: true },
      },
    },
  ],
  async executeTool(name, params) {
    if (name !== 'calculate') {
      throw new Error(`Unknown tool: ${name}`)
    }
    const expression = String(params.expression ?? '').trim()
    if (!expression) {
      throw new Error('expression parameter is required')
    }
    const result = safeEvaluate(expression)
    return `${expression} = ${result}`
  },
}
