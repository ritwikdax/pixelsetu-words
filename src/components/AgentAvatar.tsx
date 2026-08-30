interface AgentAvatarProps {
  agentId: string
  active?: boolean
  size?: 'sm' | 'md'
}

export function AgentAvatar({ agentId, active = false, size = 'md' }: AgentAvatarProps) {
  return (
    <span
      className={`agent-avatar agent-avatar--${size}${active ? ' agent-avatar--active' : ''}`}
      data-agent={agentId}
      aria-hidden="true"
    >
      <span className="agent-avatar-antenna" />
      <span className="agent-avatar-face">
        <span className="agent-avatar-eye agent-avatar-eye-left" />
        <span className="agent-avatar-eye agent-avatar-eye-right" />
        <span className="agent-avatar-mouth" />
      </span>
    </span>
  )
}

interface AgentCapsuleProps {
  agentId: string
  label: string
  active?: boolean
  compact?: boolean
}

export function AgentCapsule({ agentId, label, active = false, compact = false }: AgentCapsuleProps) {
  return (
    <span
      className={`agent-capsule${active ? ' agent-capsule--active' : ''}${compact ? ' agent-capsule--compact' : ''}`}
      data-agent={agentId}
    >
      <AgentAvatar agentId={agentId} active={active} size={compact ? 'sm' : 'md'} />
      <span className="agent-capsule-label">@{label}</span>
    </span>
  )
}
