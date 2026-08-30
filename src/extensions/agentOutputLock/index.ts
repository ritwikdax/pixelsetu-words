import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import {
  isAgentOutputNode,
  isLockedAgentOutputParagraph,
} from '../paragraphWithAgentOutput'
import {
  AGENT_OUTPUT_DELETE_META,
  AGENT_OUTPUT_UNLOCK_META,
  AGENT_STREAM_WRITE_META,
} from './meta'

export {
  AGENT_OUTPUT_DELETE_META,
  AGENT_OUTPUT_UNLOCK_META,
  AGENT_STREAM_WRITE_META,
} from './meta'

function transactionModifiesLockedAgentOutput(
  transaction: Transaction,
  oldState: EditorState,
): boolean {
  const lockedPositions: number[] = []
  oldState.doc.descendants((node, pos) => {
    if (isAgentOutputNode(node) && isLockedAgentOutputParagraph(node.attrs)) {
      lockedPositions.push(pos)
    }
  })

  for (const pos of lockedPositions) {
    const oldNode = oldState.doc.nodeAt(pos)
    if (!oldNode) continue

    const result = transaction.mapping.mapResult(pos)
    if (result.deleted) continue

    const newNode = transaction.doc.nodeAt(result.pos)
    if (!newNode) return true
    if (!isAgentOutputNode(newNode)) return true
    if (newNode.textContent !== oldNode.textContent) return true
    if (newNode.attrs.agentOutputRunning !== oldNode.attrs.agentOutputRunning) return true
    if (newNode.attrs.agentOutputLocked !== oldNode.attrs.agentOutputLocked) return true
    if (JSON.stringify(newNode.attrs.agentThoughts) !== JSON.stringify(oldNode.attrs.agentThoughts)) {
      return true
    }
  }

  return false
}

export const AgentOutputLock = Extension.create({
  name: 'agentOutputLock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('agentOutputLock'),
        filterTransaction(transaction, state) {
          if (
            transaction.getMeta(AGENT_STREAM_WRITE_META) ||
            transaction.getMeta(AGENT_OUTPUT_UNLOCK_META) ||
            transaction.getMeta(AGENT_OUTPUT_DELETE_META)
          ) {
            return true
          }

          if (!transaction.docChanged) return true

          if (transactionModifiesLockedAgentOutput(transaction, state)) {
            return false
          }

          return true
        },
      }),
    ]
  },
})
