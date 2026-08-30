import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { AgentMentionView } from './AgentMentionView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    agentMention: {
      insertAgentMention: (agentId: string) => ReturnType
      setAgentMentionActive: (active: boolean) => ReturnType
    }
  }
}

export const AgentMention = Node.create({
  name: 'agentMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  marks: '',
  priority: 1000,

  addAttributes() {
    return {
      agentId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-agent-id') ?? '',
        renderHTML: (attributes) => ({ 'data-agent-id': attributes.agentId }),
      },
      active: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-active') === 'true',
        renderHTML: (attributes) => ({
          'data-active': attributes.active ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-agent-mention]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-agent-mention': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentMentionView, {
      as: 'span',
      className: 'agent-mention-chip',
    })
  },

  addCommands() {
    return {
      insertAgentMention:
        (agentId: string) =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs: { agentId, active: false } },
              { type: 'text', text: ' ' },
            ])
            .run(),
    }
  },
})
