import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { AGENT_OUTPUT_UNLOCK_META } from '../agentOutputLock/meta'
import { deleteAgentOutputBlock } from '../../utils/agentOutputDelete'

function thoughtsFromAttrs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split('\n').map((line) => line.trim()).filter(Boolean)
  }
  return []
}

export function AgentOutputView({ node, editor, getPos }: NodeViewProps) {
  const running = Boolean(node.attrs.agentOutputRunning)
  const locked = Boolean(node.attrs.agentOutputLocked)
  const thoughts = thoughtsFromAttrs(node.attrs.agentThoughts)
  const [expanded, setExpanded] = useState(running || thoughts.length > 0)

  useEffect(() => {
    setExpanded(running)
  }, [running])

  const className = [
    'agent-output',
    running ? 'agent-output--running' : '',
    locked && !running ? 'agent-output--locked' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <NodeViewWrapper as="div" className={className} data-agent-output-block="">
      <button
        type="button"
        className="agent-output-delete"
        data-agent-delete="true"
        aria-label="Delete agent response"
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const pos = getPos()
          if (typeof pos !== 'number') return
          deleteAgentOutputBlock(editor, pos)
        }}
      >
        ×
      </button>

      {thoughts.length > 0 ? (
        <div className={`agent-thoughts ${expanded ? 'is-open' : ''}`}>
          <button
            type="button"
            className="agent-thoughts-summary"
            aria-expanded={expanded}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setExpanded((current) => !current)
            }}
          >
            <span className="agent-thoughts-chevron" aria-hidden="true">
              {expanded ? '▾' : '▸'}
            </span>
            {running ? 'Thinking…' : 'Chain of thought'}
            <span className="agent-thoughts-count">{thoughts.length}</span>
          </button>
          {expanded ? (
            <div className="agent-thoughts-body">
              {thoughts.map((thought, index) => (
                <p key={`${index}-${thought.slice(0, 24)}`}>{thought}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : running ? (
        <p className="agent-thoughts-placeholder">Thinking…</p>
      ) : null}

      <NodeViewContent
        as="div"
        className="agent-output-answer"
        onDoubleClick={(event: MouseEvent<HTMLDivElement>) => {
          if (running || !locked) return
          event.preventDefault()
          const pos = getPos()
          if (typeof pos !== 'number') return
          editor
            .chain()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                agentOutputRunning: false,
                agentOutputLocked: false,
              })
              tr.setMeta(AGENT_OUTPUT_UNLOCK_META, true)
              return true
            })
            .run()
        }}
      />

      {locked && !running ? (
        <div className="agent-output-hint">Double-click answer to edit · hover to delete</div>
      ) : null}
    </NodeViewWrapper>
  )
}
