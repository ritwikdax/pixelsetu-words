import type { Editor as TiptapEditor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { AGENT_OUTPUT_DELETE_META } from '../extensions/agentOutputLock/meta'
import { isAgentOutputNode } from '../extensions/paragraphWithAgentOutput'
import { ensureCursorInEditableParagraph } from './agentMention'

export function findAgentOutputBlockPosFromDom(
  view: EditorView,
  element: HTMLElement,
): number | null {
  const outputEl = element.closest('.agent-output')
  if (!outputEl) return null

  const pos = view.posAtDOM(outputEl, 0)
  const $pos = view.state.doc.resolve(pos)
  const nodePos = $pos.depth > 0 ? $pos.before($pos.depth) : $pos.pos
  const node = view.state.doc.nodeAt(nodePos)
  if (!isAgentOutputNode(node)) {
    return null
  }

  return nodePos
}

export function deleteAgentOutputBlock(
  editor: TiptapEditor,
  blockPos: number,
): boolean {
  const node = editor.state.doc.nodeAt(blockPos)
  if (!node || !isAgentOutputNode(node)) return false

  const from = blockPos
  const to = blockPos + node.nodeSize

  const deleted = editor
    .chain()
    .command(({ tr, state }) => {
      const current = state.doc.nodeAt(blockPos)
      if (!isAgentOutputNode(current)) return false

      tr.delete(from, to)
      tr.setMeta(AGENT_OUTPUT_DELETE_META, true)
      return true
    })
    .run()

  if (deleted) {
    ensureCursorInEditableParagraph(editor)
  }

  return deleted
}

export function tryDeleteAgentOutputOnBackspace(editor: TiptapEditor): boolean {
  const { state } = editor
  if (!state.selection.empty) return false

  const { $from } = state.selection
  if (isAgentOutputNode($from.parent)) return false
  if ($from.parent.type.name !== 'paragraph') return false
  if ($from.parentOffset !== 0) return false

  const index = $from.index($from.depth - 1)
  if (index === 0) return false

  const parent = $from.node($from.depth - 1)
  const prev = parent.child(index - 1)
  if (!isAgentOutputNode(prev)) return false

  const blockPos = $from.before($from.depth) - prev.nodeSize
  return deleteAgentOutputBlock(editor, blockPos)
}
