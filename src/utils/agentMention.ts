import type { Editor as TiptapEditor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { TextSelection } from '@tiptap/pm/state'
import { searchAgents } from '../agents/registry'
import type { AgentDefinition } from '../agents/types'
import { isAgentOutputNode, isLockedAgentOutputParagraph } from '../extensions/paragraphWithAgentOutput'
import { AGENT_STREAM_WRITE_META } from '../extensions/agentOutputLock/meta'

export const AGENT_MENTION_TRIGGER = /(?:^|\s)@([a-z0-9_-]*)$/i
export const AGENT_INVOCATION_PATTERN = /(?:^|\s)@([a-z][a-z0-9_-]*)\s+(.+)$/i

export interface AgentPickerContext {
  query: string
  from: number
  to: number
}

export interface AgentInvocation {
  agentId: string
  prompt: string
  from: number
  to: number
}

export interface AgentPickerItem {
  agent: AgentDefinition
}

function getTextblockContext(state: EditorState) {
  const { from } = state.selection
  if (!state.selection.empty) return null

  const $pos = state.doc.resolve(from)
  if (!$pos.parent.isTextblock) return null

  return {
    from,
    parentStart: $pos.start(),
    parentOffset: $pos.parentOffset,
    offset: $pos.parentOffset,
    text: $pos.parent.textContent,
    parent: $pos.parent,
  }
}

function getLineTextBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const lineBreak = before.lastIndexOf('\n')
  return lineBreak === -1 ? before : before.slice(lineBreak + 1)
}

function findMentionInParagraph(
  parent: ProseMirrorNode,
  parentStart: number,
): { agentId: string; mentionFrom: number; promptStart: number; to: number } | null {
  let agentId: string | null = null
  let mentionFrom = -1
  let promptStart = -1

  parent.forEach((node, offset) => {
    if (node.type.name !== 'agentMention' || agentId !== null) return
    agentId = String(node.attrs.agentId ?? '')
    mentionFrom = parentStart + offset
    promptStart = mentionFrom + node.nodeSize
  })

  if (!agentId || mentionFrom < 0 || promptStart < 0) return null

  return {
    agentId,
    mentionFrom,
    promptStart,
    to: parentStart + parent.content.size,
  }
}

function invocationFromMention(
  state: EditorState,
  mention: { agentId: string; mentionFrom: number; promptStart: number; to: number },
): AgentInvocation | null {
  const prompt = state.doc.textBetween(mention.promptStart, mention.to).trim()
  if (!prompt) return null

  return {
    agentId: mention.agentId,
    prompt,
    from: mention.mentionFrom,
    to: mention.to,
  }
}

function getAgentInvocationFromChip(state: EditorState): AgentInvocation | null {
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return null

  const current = findMentionInParagraph($from.parent, $from.start())
  if (current) return invocationFromMention(state, current)

  const depth = $from.depth
  if (depth < 1) return null

  const index = $from.index(depth - 1)
  if (index === 0) return null

  const prev = $from.node(depth - 1).child(index - 1)
  if (prev.type.name !== 'paragraph') return null

  const prevPos = $from.before(depth) - prev.nodeSize
  const previous = findMentionInParagraph(prev, prevPos + 1)
  if (!previous) return null

  return invocationFromMention(state, previous)
}

export function getAgentPickerContext(state: EditorState): AgentPickerContext | null {
  const ctx = getTextblockContext(state)
  if (!ctx) return null

  let hasAgentChip = false
  ctx.parent.forEach((node) => {
    if (node.type.name === 'agentMention') hasAgentChip = true
  })
  if (hasAgentChip) return null

  const line = getLineTextBeforeCursor(ctx.text, ctx.offset)
  const match = line.match(AGENT_MENTION_TRIGGER)
  if (!match) return null

  const fullMatch = match[0]
  const atOffset = fullMatch.indexOf('@')
  const triggerLength = fullMatch.length - atOffset
  const from = ctx.from - triggerLength
  const to = ctx.from

  return {
    query: match[1] ?? '',
    from,
    to,
  }
}

export function isAgentMentionActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return AGENT_MENTION_TRIGGER.test(line)
}

export function parseAgentInvocation(text: string): AgentInvocation | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^@([a-z][a-z0-9_-]*)\s+(.+)$/i)
  if (!match) return null

  return {
    agentId: match[1]!.toLowerCase(),
    prompt: match[2]!.trim(),
    from: 0,
    to: trimmed.length,
  }
}

export function getAgentInvocationAtCursor(state: EditorState): AgentInvocation | null {
  const chipInvocation = getAgentInvocationFromChip(state)
  if (chipInvocation) return chipInvocation

  const ctx = getTextblockContext(state)
  if (!ctx) return null

  const line = getLineTextBeforeCursor(ctx.text, ctx.offset)
  const match = line.match(AGENT_INVOCATION_PATTERN)
  if (!match) return null

  const fullMatch = match[0]
  const atOffset = fullMatch.indexOf('@')
  const from = ctx.from - (fullMatch.length - atOffset)

  return {
    agentId: match[1]!.toLowerCase(),
    prompt: match[2]!.trim(),
    from,
    to: ctx.parentStart + ctx.parent.content.size,
  }
}

export function searchAgentPickerItems(query: string, limit = 8): AgentPickerItem[] {
  return searchAgents(query, limit).map((agent) => ({ agent }))
}

export function isCursorInLockedAgentOutput(state: EditorState): boolean {
  const { $from } = state.selection
  return isAgentOutputNode($from.parent) && isLockedAgentOutputParagraph($from.parent.attrs as Record<string, unknown>)
}

export function isSelectionInAgentOutputBlock(state: EditorState): boolean {
  const { $from } = state.selection
  return isAgentOutputNode($from.parent)
}

function isEditableParagraph(node: ProseMirrorNode): boolean {
  return node.type.name === 'paragraph' && !isAgentOutputNode(node)
}

function clampPos(state: EditorState, pos: number): number {
  return Math.max(1, Math.min(pos, state.doc.content.size))
}

function setEditorSelection(editor: TiptapEditor, pos: number): number {
  const { state, view } = editor
  const clamped = clampPos(state, pos)
  const tr = state.tr.setSelection(TextSelection.create(state.doc, clamped))
  tr.setMeta(AGENT_STREAM_WRITE_META, true)
  view.dispatch(tr)
  editor.commands.focus()
  return clamped
}

export function findPosAfterBlock(state: EditorState, blockPos: number): number | null {
  const node = state.doc.nodeAt(blockPos)
  if (!node) return null

  const after = blockPos + node.nodeSize
  if (after >= state.doc.content.size) return after

  const next = state.doc.nodeAt(after)
  if (next && isEditableParagraph(next)) {
    return after + 1
  }

  return null
}

export function ensureParagraphAfterBlock(editor: TiptapEditor, blockPos: number): number {
  const existing = findPosAfterBlock(editor.state, blockPos)
  if (existing !== null) {
    return setEditorSelection(editor, existing)
  }

  const node = editor.state.doc.nodeAt(blockPos)
  if (!node) return setEditorSelection(editor, editor.state.selection.from)

  const insertAt = blockPos + node.nodeSize
  editor
    .chain()
    .focus()
    .insertContentAt(insertAt, { type: 'paragraph' })
    .setTextSelection(insertAt + 1)
    .run()

  return editor.state.selection.from
}

export function ensureCursorInEditableParagraph(
  editor: TiptapEditor,
  preferredPos?: number,
): number {
  const { state } = editor
  let pos = clampPos(state, preferredPos ?? state.selection.from)
  let $pos = state.doc.resolve(pos)

  if (isAgentOutputNode($pos.parent)) {
    const blockPos = $pos.before($pos.depth)
    return ensureParagraphAfterBlock(editor, blockPos)
  }

  if (isEditableParagraph($pos.parent)) {
    return setEditorSelection(editor, $pos.pos)
  }

  let fallback: number | null = null
  state.doc.descendants((node, nodePos) => {
    if (fallback !== null) return false
    if (isEditableParagraph(node)) {
      fallback = nodePos + 1
      return false
    }
    return undefined
  })

  return setEditorSelection(editor, fallback ?? state.doc.content.size)
}

export function insertAgentMention(
  editor: TiptapEditor,
  agentId: string,
  from: number,
  to: number,
): void {
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContentAt(from, [
      { type: 'agentMention', attrs: { agentId, active: false } },
      { type: 'text', text: ' ' },
    ])
    .run()
}

export function startAgentOutput(
  editor: TiptapEditor,
  invocation: AgentInvocation,
): { runId: string } {
  const { from, to, agentId, prompt } = invocation
  const runId = `agent-run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContentAt(from, [
      { type: 'agentMention', attrs: { agentId, active: true } },
      { type: 'text', text: ` ${prompt}` },
    ])
    .run()

  const { $from } = editor.state.selection
  const invocationPos = $from.before($from.depth)
  const invocationNode = editor.state.doc.nodeAt(invocationPos)
  if (!invocationNode) {
    return { runId }
  }

  const outputPos = invocationPos + invocationNode.nodeSize
  editor
    .chain()
    .insertContentAt(outputPos, {
      type: 'agentOutput',
      attrs: {
        agentOutput: true,
        agentOutputRunning: true,
        agentOutputLocked: true,
        agentRunId: runId,
        agentThoughts: [],
      },
    })
    .run()

  const outputNode = editor.state.doc.nodeAt(outputPos)
  if (!outputNode) {
    return { runId }
  }

  const afterOutput = outputPos + outputNode.nodeSize
  editor
    .chain()
    .insertContentAt(afterOutput, { type: 'paragraph' })
    .setTextSelection(afterOutput + 1)
    .run()

  return { runId }
}

function findAgentOutputByRunId(
  doc: ProseMirrorNode,
  runId: string,
): { pos: number; node: ProseMirrorNode } | null {
  let found: { pos: number; node: ProseMirrorNode } | null = null
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.type.name === 'agentOutput' && node.attrs.agentRunId === runId) {
      found = { pos, node }
      return false
    }
    return undefined
  })
  return found
}

function dispatchAgentWrite(
  editor: TiptapEditor,
  mutate: (tr: Transaction) => boolean,
): void {
  const { state, view } = editor
  const selectionFrom = state.selection.from
  const selectionTo = state.selection.to
  const tr = state.tr
  if (!mutate(tr)) return

  tr.setMeta(AGENT_STREAM_WRITE_META, true)
  tr.setMeta('addToHistory', false)
  const mappedFrom = tr.mapping.map(selectionFrom)
  const mappedTo = tr.mapping.map(selectionTo)
  const size = tr.doc.content.size
  if (mappedFrom >= 0 && mappedTo <= size && mappedFrom <= mappedTo) {
    try {
      tr.setSelection(TextSelection.create(tr.doc, mappedFrom, mappedTo))
    } catch {
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(mappedFrom, size))))
    }
  }
  view.dispatch(tr)
}

export function appendAgentChunk(editor: TiptapEditor, runId: string, chunk: string): void {
  if (!chunk) return

  dispatchAgentWrite(editor, (tr) => {
    const found = findAgentOutputByRunId(tr.doc, runId)
    if (!found?.node.attrs.agentOutputRunning) return false

    const insertPos = found.pos + found.node.content.size + 1
    tr.insertText(chunk, insertPos)
    return true
  })
}

export function appendAgentStatus(editor: TiptapEditor, runId: string, text: string): void {
  const trimmed = text.trim()
  if (!trimmed || trimmed === 'Writing…') return

  dispatchAgentWrite(editor, (tr) => {
    const found = findAgentOutputByRunId(tr.doc, runId)
    if (!found?.node.attrs.agentOutputRunning) return false

    const previous = Array.isArray(found.node.attrs.agentThoughts)
      ? found.node.attrs.agentThoughts.map((item: unknown) => String(item))
      : []
    tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      agentThoughts: [...previous, trimmed],
    })
    return true
  })
}

export function finalizeAgentOutput(editor: TiptapEditor, runId: string): void {
  dispatchAgentWrite(editor, (tr) => {
    const found = findAgentOutputByRunId(tr.doc, runId)
    if (found?.node.attrs.agentOutput) {
      tr.setNodeMarkup(found.pos, undefined, {
        ...found.node.attrs,
        agentOutputRunning: false,
        agentOutputLocked: true,
      })
    }

    const mentionPositions: number[] = []
    tr.doc.descendants((node, pos) => {
      if (node.type.name === 'agentMention' && node.attrs.active) {
        mentionPositions.push(pos)
      }
    })

    for (const pos of mentionPositions) {
      const $pos = tr.doc.resolve(pos)
      const blockPos = $pos.before($pos.depth)
      const block = tr.doc.nodeAt(blockPos)
      if (!block) continue

      const next = tr.doc.nodeAt(blockPos + block.nodeSize)
      if (next?.attrs.agentRunId !== runId) continue

      const mention = tr.doc.nodeAt(pos)
      if (mention?.type.name !== 'agentMention') continue
      tr.setNodeMarkup(pos, undefined, { ...mention.attrs, active: false })
    }

    return tr.steps.length > 0
  })
}
