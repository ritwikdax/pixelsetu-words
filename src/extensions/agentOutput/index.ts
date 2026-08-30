import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { AgentOutputView } from './AgentOutputView'

function parseThoughts(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).filter((item) => item.trim().length > 0)
    }
  } catch {
    return value.split('\n').map((line) => line.trim()).filter(Boolean)
  }
  return []
}

export const AgentOutput = Node.create({
  name: 'agentOutput',
  group: 'block',
  content: 'inline*',
  defining: true,
  isolating: true,
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      agentOutput: {
        default: true,
        parseHTML: () => true,
        renderHTML: () => ({ 'data-agent-output': 'true' }),
      },
      agentOutputRunning: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-agent-running') === 'true',
        renderHTML: (attributes) => ({
          'data-agent-running': attributes.agentOutputRunning ? 'true' : 'false',
        }),
      },
      agentOutputLocked: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-agent-locked') !== 'false',
        renderHTML: (attributes) => ({
          'data-agent-locked': attributes.agentOutputLocked ? 'true' : 'false',
        }),
      },
      agentRunId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-agent-run-id'),
        renderHTML: (attributes) => {
          if (!attributes.agentRunId) return {}
          return { 'data-agent-run-id': attributes.agentRunId }
        },
      },
      agentThoughts: {
        default: [],
        parseHTML: (element) => parseThoughts(element.getAttribute('data-agent-thoughts')),
        renderHTML: (attributes) => {
          const thoughts = attributes.agentThoughts
          if (!Array.isArray(thoughts) || thoughts.length === 0) return {}
          return { 'data-agent-thoughts': JSON.stringify(thoughts) }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-agent-output-block]', priority: 60 },
      { tag: 'p.agent-output', priority: 60 },
      { tag: 'div.agent-output', priority: 60 },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'agent-output',
        'data-agent-output-block': '',
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentOutputView, {
      stopEvent: ({ event }) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return false
        return Boolean(target.closest('.agent-thoughts, button.agent-output-delete'))
      },
    })
  },
})
