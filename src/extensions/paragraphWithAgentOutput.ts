import Paragraph from '@tiptap/extension-paragraph'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

function agentOutputClasses(attributes: Record<string, unknown>): string {
  const classes = ['agent-output']
  if (attributes.agentOutputRunning) classes.push('agent-output--running')
  if (attributes.agentOutputLocked && !attributes.agentOutputRunning) {
    classes.push('agent-output--locked')
  }
  return classes.join(' ')
}

export const ParagraphWithAgentOutput = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      agentOutput: {
        default: false,
        parseHTML: () => false,
        renderHTML: (attributes) => {
          if (!attributes.agentOutput) return {}
          return {
            class: agentOutputClasses(attributes),
            'data-agent-output': 'true',
            'data-agent-running': attributes.agentOutputRunning ? 'true' : 'false',
            'data-agent-locked': attributes.agentOutputLocked ? 'true' : 'false',
          }
        },
      },
      agentOutputRunning: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-agent-running') === 'true',
        renderHTML: () => ({}),
      },
      agentOutputLocked: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-agent-locked') === 'true',
        renderHTML: () => ({}),
      },
      agentRunId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-agent-run-id'),
        renderHTML: (attributes) => {
          if (!attributes.agentRunId) return {}
          return { 'data-agent-run-id': attributes.agentRunId }
        },
      },
    }
  },
})

export function isAgentOutputNode(node: ProseMirrorNode | null | undefined): boolean {
  if (!node) return false
  return node.type.name === 'agentOutput' || Boolean(node.attrs.agentOutput)
}

export function isReadOnlyAgentOutputParagraph(attrs: Record<string, unknown>): boolean {
  return Boolean(attrs.agentOutput && (attrs.agentOutputLocked || attrs.agentOutputRunning))
}

export function isLockedAgentOutputParagraph(attrs: Record<string, unknown>): boolean {
  return isReadOnlyAgentOutputParagraph(attrs)
}

export function paragraphTouchesLockedAgentOutput(
  doc: ProseMirrorNode,
  start: number,
  end: number,
): boolean {
  let touches = false
  doc.nodesBetween(start, Math.max(start, end), (node, pos) => {
    if (touches) return false
    if (!isAgentOutputNode(node)) return true
    if (!node.attrs.agentOutputLocked && !node.attrs.agentOutputRunning) return true

    const nodeEnd = pos + node.nodeSize
    if (start < nodeEnd && end > pos) {
      touches = true
      return false
    }
    return true
  })
  return touches
}
