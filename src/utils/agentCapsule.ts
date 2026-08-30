import { getAgent } from '../agents/registry'

const AGENT_ACCENTS: Record<string, string> = {
  bro: '#f59e0b',
  weather: '#0ea5e9',
  calculator: '#10b981',
  time: '#8b5cf6',
}

export function getAgentAccent(agentId: string): string {
  return AGENT_ACCENTS[agentId.toLowerCase()] ?? 'var(--accent)'
}

export function getAgentDisplayName(agentId: string): string {
  return getAgent(agentId)?.name ?? agentId.charAt(0).toUpperCase() + agentId.slice(1)
}

/** Inline robotic avatar markup (CSS-animated). */
export function agentAvatarMarkup(agentId: string, active = false): string {
  const accent = getAgentAccent(agentId)
  return `<span class="agent-avatar${active ? ' agent-avatar--active' : ''}" style="--agent-accent:${accent}" aria-hidden="true"><span class="agent-avatar-antenna"></span><span class="agent-avatar-face"><span class="agent-avatar-eye agent-avatar-eye-left"></span><span class="agent-avatar-eye agent-avatar-eye-right"></span><span class="agent-avatar-mouth"></span></span></span>`
}

export function agentCapsuleMarkup(
  agentId: string,
  options: { active?: boolean; compact?: boolean } = {},
): string {
  const label = getAgentDisplayName(agentId)
  const accent = getAgentAccent(agentId)
  const activeClass = options.active ? ' agent-capsule--active' : ''
  const compactClass = options.compact ? ' agent-capsule--compact' : ''

  return `<span class="agent-capsule${activeClass}${compactClass}" data-agent="${agentId}" style="--agent-accent:${accent}">${agentAvatarMarkup(agentId, options.active)}<span class="agent-capsule-label">@${label}</span></span>`
}

export function agentInvocationMarkup(
  agentId: string,
  prompt: string,
  options: { active?: boolean } = {},
): string {
  const escapedPrompt = prompt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const rowClass = options.active ? 'agent-invocation-row agent-invocation-row--active' : 'agent-invocation-row'

  return `<p class="${rowClass}">${agentCapsuleMarkup(agentId, { active: options.active })}<span class="agent-prompt">${escapedPrompt}</span></p>`
}
