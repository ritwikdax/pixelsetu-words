import { broAgent } from './bro'
import { calculatorAgent } from './calculator'
import { timeAgent } from './time'
import { weatherAgent } from './weather'
import type { AgentDefinition } from './types'

const agents: AgentDefinition[] = [broAgent, weatherAgent, calculatorAgent, timeAgent]

const agentMap = new Map(agents.map((agent) => [agent.id, agent]))

export function listAgents(): AgentDefinition[] {
  return agents
}

export function getAgent(id: string): AgentDefinition | undefined {
  return agentMap.get(id.toLowerCase())
}

export function searchAgents(query: string, limit = 8): AgentDefinition[] {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return agents.slice(0, limit)

  return agents
    .filter(
      (agent) =>
        agent.id.includes(normalized) ||
        agent.name.toLowerCase().includes(normalized) ||
        agent.description.toLowerCase().includes(normalized),
    )
    .slice(0, limit)
}
