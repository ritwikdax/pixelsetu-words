import type { AgentDefinition } from './types'

export function formatTime(timezone: string): string {
  try {
    const now = new Date()
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    }).format(now)
    return `Current time in ${timezone}: ${formatted}`
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`)
  }
}

export const timeAgent: AgentDefinition = {
  id: 'time',
  name: 'Time',
  description: 'Get current time in any timezone',
  systemPrompt:
    'You are a time assistant. Use the getTime tool with an IANA timezone ' +
    '(e.g. Asia/Kolkata, America/New_York). Infer timezone from city names when possible.',
  tools: [
    {
      name: 'getTime',
      description: 'Get current date and time in a timezone',
      parameters: {
        timezone: { type: 'string', description: 'IANA timezone name', required: true },
      },
    },
  ],
  async executeTool(name, params) {
    if (name !== 'getTime') {
      throw new Error(`Unknown tool: ${name}`)
    }
    const timezone = String(params.timezone ?? '').trim()
    if (!timezone) {
      throw new Error('timezone parameter is required')
    }
    return formatTime(timezone)
  },
}
