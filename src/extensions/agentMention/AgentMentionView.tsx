import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { AgentCapsule } from '../../components/AgentAvatar'
import { getAgentDisplayName } from '../../utils/agentCapsule'

export function AgentMentionView({ node }: NodeViewProps) {
  const agentId = String(node.attrs.agentId ?? '')
  const active = Boolean(node.attrs.active)

  return (
    <NodeViewWrapper as="span" className="agent-mention-chip" contentEditable={false}>
      <AgentCapsule
        agentId={agentId}
        label={getAgentDisplayName(agentId)}
        active={active}
      />
    </NodeViewWrapper>
  )
}
