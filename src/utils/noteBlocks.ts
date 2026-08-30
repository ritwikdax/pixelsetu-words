import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EMPTY_CURL_ATTRS } from '../extensions/curlBlock'
import { isAgentOutputNode } from '../extensions/paragraphWithAgentOutput'
import { normalizeUrl } from './url'

const SNAPSHOT_MAX = 24000

const PROTECTED_NODE_TYPES = new Set(['agentOutput', 'agentMention'])

export const NOTE_TOOL_NAMES = [
  'getNote',
  'insertBlocks',
  'replaceBlock',
  'replaceBlocks',
  'deleteBlocks',
] as const

export type NoteToolName = (typeof NOTE_TOOL_NAMES)[number]

export function isNoteToolName(name: string): name is NoteToolName {
  return (NOTE_TOOL_NAMES as readonly string[]).includes(name)
}

export interface NoteBlockSpec {
  type: string
  text?: string
  level?: number
  language?: string
  items?: Array<string | { text?: string; checked?: boolean }>
  method?: string
  url?: string
  headers?: string
  body?: string
  src?: string
  alt?: string
  checked?: boolean
}

interface IndexedBlock {
  id: string
  pos: number
  size: number
  node: ProseMirrorNode
  protected: boolean
}

function isProtectedBlock(node: ProseMirrorNode): boolean {
  if (PROTECTED_NODE_TYPES.has(node.type.name) || isAgentOutputNode(node)) return true
  let found = false
  node.descendants((child) => {
    if (child.type.name === 'agentMention' || isAgentOutputNode(child)) {
      found = true
      return false
    }
    return undefined
  })
  return found
}

function listTopLevelBlocks(doc: ProseMirrorNode): IndexedBlock[] {
  const blocks: IndexedBlock[] = []
  doc.forEach((node, offset, index) => {
    blocks.push({
      id: `b${index + 1}`,
      pos: offset,
      size: node.nodeSize,
      node,
      protected: isProtectedBlock(node),
    })
  })
  return blocks
}

function findBlock(blocks: IndexedBlock[], id: string): IndexedBlock {
  const match = blocks.find((block) => block.id === id.toLowerCase())
  if (!match) {
    throw new Error(`Unknown block id "${id}". Use ids from the latest note snapshot.`)
  }
  return match
}

function parseInlineMarkdown(text: string): JSONContent[] {
  if (!text) return []

  const nodes: JSONContent[] = []
  const token =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

  const pushPlain = (value: string) => {
    const parts = value.split('\n')
    parts.forEach((part, index) => {
      if (part) nodes.push({ type: 'text', text: part })
      if (index < parts.length - 1) nodes.push({ type: 'hardBreak' })
    })
  }

  let last = 0
  let match: RegExpExecArray | null
  while ((match = token.exec(text))) {
    if (match.index > last) pushPlain(text.slice(last, match.index))
    const raw = match[0]
    if (raw.startsWith('**') || raw.startsWith('__')) {
      nodes.push({ type: 'text', text: raw.slice(2, -2), marks: [{ type: 'bold' }] })
    } else if (raw.startsWith('~~')) {
      nodes.push({ type: 'text', text: raw.slice(2, -2), marks: [{ type: 'strike' }] })
    } else if (raw.startsWith('`')) {
      nodes.push({ type: 'text', text: raw.slice(1, -1), marks: [{ type: 'code' }] })
    } else if (raw.startsWith('[')) {
      const labelEnd = raw.indexOf(']')
      const href = raw.slice(labelEnd + 2, -1)
      const label = raw.slice(1, labelEnd)
      const normalized = normalizeUrl(href) ?? href
      nodes.push({
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href: normalized } }],
      })
    } else {
      nodes.push({ type: 'text', text: raw.slice(1, -1), marks: [{ type: 'italic' }] })
    }
    last = match.index + raw.length
  }

  if (last < text.length) pushPlain(text.slice(last))
  return nodes
}

function paragraphNode(text = '', extra?: JSONContent[]): JSONContent {
  const content = [...parseInlineMarkdown(text), ...(extra ?? [])]
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function headingNode(level: number, text: string): JSONContent {
  const clamped = Math.min(3, Math.max(1, Math.round(level) || 1))
  const content = parseInlineMarkdown(text)
  return content.length > 0
    ? { type: 'heading', attrs: { level: clamped }, content }
    : { type: 'heading', attrs: { level: clamped } }
}

function listItemNode(text: string): JSONContent {
  return { type: 'listItem', content: [paragraphNode(text)] }
}

function taskItemNode(text: string, checked = false): JSONContent {
  return {
    type: 'taskItem',
    attrs: { checked: Boolean(checked) },
    content: [paragraphNode(text)],
  }
}

function itemText(item: string | { text?: string; checked?: boolean }): string {
  return typeof item === 'string' ? item : String(item.text ?? '')
}

function specToContent(spec: NoteBlockSpec): JSONContent {
  const type = String(spec.type ?? '').trim()
  const normalized = type.replace(/[\s_]+/g, '').toLowerCase()

  if (
    normalized === 'agent' ||
    normalized === 'agentmention' ||
    normalized === 'agentoutput' ||
    normalized === 'agentblock'
  ) {
    throw new Error('Agent blocks cannot be created or edited')
  }

  switch (normalized) {
    case 'paragraph':
    case 'p':
    case 'text':
      if (spec.src) {
        const src = String(spec.src)
        if (!/^https?:\/\//i.test(src)) throw new Error('image src must be an http(s) URL')
        return {
          type: 'paragraph',
          content: [
            ...parseInlineMarkdown(spec.text ?? ''),
            { type: 'image', attrs: { src, alt: spec.alt ?? '' } },
          ],
        }
      }
      return paragraphNode(spec.text ?? '')
    case 'heading':
    case 'h1':
    case 'h2':
    case 'h3': {
      const level =
        normalized === 'h1' ? 1 : normalized === 'h2' ? 2 : normalized === 'h3' ? 3 : spec.level ?? 1
      return headingNode(level, spec.text ?? '')
    }
    case 'blockquote':
    case 'quote': {
      const paragraphs = String(spec.text ?? '')
        .split(/\n{2,}/)
        .map((part) => paragraphNode(part))
      return {
        type: 'blockquote',
        content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
      }
    }
    case 'codeblock':
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: spec.language?.trim() || 'javascript' },
        content: spec.text ? [{ type: 'text', text: spec.text }] : [],
      }
    case 'bulletlist':
    case 'bullets':
    case 'ul': {
      const items = spec.items ?? []
      return {
        type: 'bulletList',
        content: (items.length > 0 ? items : ['']).map((item) => listItemNode(itemText(item))),
      }
    }
    case 'numberedlist':
    case 'orderedlist':
    case 'ol': {
      const items = spec.items ?? []
      return {
        type: 'orderedList',
        content: (items.length > 0 ? items : ['']).map((item) => listItemNode(itemText(item))),
      }
    }
    case 'todolist':
    case 'todo':
    case 'tasklist': {
      const items = spec.items ?? []
      return {
        type: 'taskList',
        content: (items.length > 0 ? items : [{ text: '' }]).map((item) =>
          taskItemNode(itemText(item), typeof item === 'object' ? Boolean(item.checked) : false),
        ),
      }
    }
    case 'divider':
    case 'hr':
    case 'horizontalrule':
      return { type: 'horizontalRule' }
    case 'curl':
    case 'curlblock':
    case 'apirequest': {
      const url = String(spec.url ?? '').trim()
      return {
        type: 'curlBlock',
        attrs: {
          ...EMPTY_CURL_ATTRS,
          method: String(spec.method ?? 'GET').toUpperCase() || 'GET',
          url,
          headers: spec.headers?.trim() || '{}',
          body: spec.body ?? '',
          configured: Boolean(url),
        },
      }
    }
    case 'image':
    case 'img': {
      const src = String(spec.src ?? spec.url ?? '')
      if (!/^https?:\/\//i.test(src)) throw new Error('image src must be an http(s) URL')
      return {
        type: 'paragraph',
        content: [{ type: 'image', attrs: { src, alt: spec.alt ?? spec.text ?? '' } }],
      }
    }
    default:
      throw new Error(
        `Unsupported block type "${spec.type}". Use paragraph, heading, blockquote, codeBlock, bulletList, numberedList, todoList, divider, curl, or image.`,
      )
  }
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,3} /.test(line) ||
    line.startsWith('```') ||
    /^---+$/.test(line.trim()) ||
    line.startsWith('> ') ||
    /^[-*] \[[ xX]\] /.test(line) ||
    /^[-*] /.test(line) ||
    /^\d+\. /.test(line)
  )
}

function parseMarkdownBlocks(markdown: string): JSONContent[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: JSONContent[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const code: string[] = []
      i += 1
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        code.push(lines[i] ?? '')
        i += 1
      }
      if (i < lines.length) i += 1
      out.push({
        type: 'codeBlock',
        attrs: { language: language || 'javascript' },
        content: code.length > 0 ? [{ type: 'text', text: code.join('\n') }] : [],
      })
      continue
    }

    if (/^---+$/.test(line.trim()) && line.trim().length >= 3) {
      out.push({ type: 'horizontalRule' })
      i += 1
      continue
    }

    if (/^#{1,3} /.test(line)) {
      const level = line.startsWith('### ') ? 3 : line.startsWith('## ') ? 2 : 1
      const text = line.replace(/^#{1,3} /, '')
      out.push(headingNode(level, text))
      i += 1
      continue
    }

    if (line.startsWith('> ')) {
      const quoted: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        quoted.push((lines[i] ?? '').replace(/^> /, ''))
        i += 1
      }
      out.push({
        type: 'blockquote',
        content: quoted.join('\n').split(/\n{2,}/).map((part) => paragraphNode(part)),
      })
      continue
    }

    if (/^[-*] \[[ xX]\] /.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^[-*] \[[ xX]\] /.test(lines[i] ?? '')) {
        const current = lines[i] ?? ''
        const checked = /\[[xX]\]/.test(current)
        const text = current.replace(/^[-*] \[[ xX]\] /, '')
        items.push(taskItemNode(text, checked))
        i += 1
      }
      out.push({ type: 'taskList', content: items })
      continue
    }

    if (/^[-*] /.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^[-*] /.test(lines[i] ?? '') && !/^[-*] \[[ xX]\] /.test(lines[i] ?? '')) {
        items.push(listItemNode((lines[i] ?? '').replace(/^[-*] /, '')))
        i += 1
      }
      out.push({ type: 'bulletList', content: items })
      continue
    }

    if (/^\d+\. /.test(line)) {
      const items: JSONContent[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? '')) {
        items.push(listItemNode((lines[i] ?? '').replace(/^\d+\. /, '')))
        i += 1
      }
      out.push({ type: 'orderedList', content: items })
      continue
    }

    if (line.trim() === '') {
      i += 1
      continue
    }

    const para: string[] = [line]
    i += 1
    while (i < lines.length && (lines[i] ?? '').trim() !== '' && !isBlockStart(lines[i] ?? '')) {
      para.push(lines[i] ?? '')
      i += 1
    }
    out.push(paragraphNode(para.join('\n')))
  }

  return out
}

function parseJsonParam(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return value
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return value
    }
  }
  return value
}

function parseBlockSpecs(value: unknown): NoteBlockSpec[] {
  const parsed = parseJsonParam(value)
  if (Array.isArray(parsed)) return parsed as NoteBlockSpec[]
  if (parsed && typeof parsed === 'object') return [parsed as NoteBlockSpec]
  throw new Error('blocks must be an array of block objects')
}

function parseIdList(value: unknown): string[] {
  const parsed = parseJsonParam(value)
  if (Array.isArray(parsed)) {
    return parsed.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
  }
  if (typeof parsed === 'string') {
    return parsed
      .split(/[\s,]+/)
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean)
  }
  throw new Error('ids must be an array of block ids')
}

function contentFromParams(params: Record<string, unknown>, required = true): JSONContent[] {
  const markdown = String(params.markdown ?? '').trim()
  if (markdown) return parseMarkdownBlocks(markdown)

  if (params.block !== undefined) {
    const specs = parseBlockSpecs(params.block)
    return specs.map((spec) => specToContent(spec))
  }

  if (params.blocks !== undefined) {
    return parseBlockSpecs(params.blocks).map((spec) => specToContent(spec))
  }

  if (!required) return []
  throw new Error('Provide markdown or blocks')
}

function formatListItems(node: ProseMirrorNode, checkbox: boolean): string {
  const lines: string[] = []
  node.forEach((item) => {
    const text = item.textContent.trim()
    if (checkbox) {
      const checked = Boolean(item.attrs.checked)
      lines.push(`  - [${checked ? 'x' : ' '}] ${text}`)
      return
    }
    lines.push(`  - ${text}`)
  })
  return lines.join('\n')
}

function describeBlock(block: IndexedBlock): string {
  const { id, node, protected: locked } = block
  const flag = locked ? ' (read-only)' : ''
  const type = node.type.name

  if (type === 'heading') {
    return `[${id}] heading ${node.attrs.level}${flag} | ${node.textContent}`
  }
  if (type === 'codeBlock') {
    const language = node.attrs.language ?? 'text'
    const body = node.textContent
    return `[${id}] codeBlock ${language}${flag}\n${body}`
  }
  if (type === 'bulletList') {
    return `[${id}] bulletList${flag}\n${formatListItems(node, false)}`
  }
  if (type === 'orderedList') {
    return `[${id}] numberedList${flag}\n${formatListItems(node, false)}`
  }
  if (type === 'taskList') {
    return `[${id}] todoList${flag}\n${formatListItems(node, true)}`
  }
  if (type === 'blockquote') {
    return `[${id}] quote${flag} | ${node.textContent}`
  }
  if (type === 'horizontalRule') {
    return `[${id}] divider${flag}`
  }
  if (type === 'curlBlock') {
    const method = String(node.attrs.method ?? 'GET')
    const url = String(node.attrs.url ?? '')
    return `[${id}] curl${flag} | ${method} ${url || '(not configured)'}`
  }
  if (type === 'agentOutput' || isAgentOutputNode(node)) {
    return `[${id}] agentOutput${flag} | ${node.textContent}`
  }
  if (type === 'paragraph') {
    const mention = (() => {
      let agentId = ''
      node.descendants((child) => {
        if (child.type.name === 'agentMention') {
          agentId = String(child.attrs.agentId ?? '')
          return false
        }
        return undefined
      })
      return agentId
    })()
    if (mention) {
      return `[${id}] agentInvocation${flag} | @${mention} ${node.textContent}`.trim()
    }
    const images: string[] = []
    node.descendants((child) => {
      if (child.type.name === 'image' && child.attrs.src) {
        images.push(String(child.attrs.src))
      }
    })
    const imageNote = images.length > 0 ? ` [image: ${images.join(', ')}]` : ''
    return `[${id}] paragraph${flag} | ${node.textContent}${imageNote}`
  }

  return `[${id}] ${type}${flag} | ${node.textContent}`
}

export function serializeNotePage(editor: Editor, title?: string): string {
  const blocks = listTopLevelBlocks(editor.state.doc)
  const body =
    blocks.length === 0
      ? '(empty note)'
      : blocks.map((block) => describeBlock(block)).join('\n')
  const header = title?.trim() ? `Title: ${title.trim()}\n\n` : ''
  const snapshot = `${header}Blocks:\n${body}`
  if (snapshot.length <= SNAPSHOT_MAX) return snapshot
  return `${snapshot.slice(0, SNAPSHOT_MAX)}\n\n[note truncated]`
}

function assertEditable(block: IndexedBlock, action: string): void {
  if (block.protected) {
    throw new Error(`Cannot ${action} ${block.id}: agent blocks are read-only`)
  }
}

function insertAt(editor: Editor, pos: number, content: JSONContent[]): boolean {
  if (content.length === 0) throw new Error('Nothing to insert')
  return editor.chain().insertContentAt(pos, content).run()
}

function replaceRange(editor: Editor, from: number, to: number, content: JSONContent[]): boolean {
  if (content.length === 0) throw new Error('Nothing to insert')
  return editor.chain().insertContentAt({ from, to }, content).run()
}

function deleteRange(editor: Editor, from: number, to: number): boolean {
  return editor.chain().deleteRange({ from, to }).run()
}

function ensureDocumentNotEmpty(editor: Editor): void {
  if (editor.state.doc.childCount === 0) {
    editor.chain().insertContent({ type: 'paragraph' }).run()
  }
}

function snapshotResult(editor: Editor, message: string, title?: string): string {
  return `${message}\n\nUpdated note:\n${serializeNotePage(editor, title)}`
}

export function executeNoteTool(
  editor: Editor,
  name: string,
  params: Record<string, unknown>,
  title?: string,
): string {
  if (!isNoteToolName(name)) {
    throw new Error(`Unknown note tool: ${name}`)
  }

  if (name === 'getNote') {
    return serializeNotePage(editor, title)
  }

  const blocks = listTopLevelBlocks(editor.state.doc)

  if (name === 'insertBlocks') {
    const content = contentFromParams(params)
    const after = String(params.after ?? 'end').trim().toLowerCase()
    const before = String(params.before ?? '').trim().toLowerCase()

    let pos = editor.state.doc.content.size
    if (before) {
      pos = findBlock(blocks, before).pos
    } else if (after === 'start') {
      pos = 0
    } else if (after === 'end' || after === '') {
      const last = blocks[blocks.length - 1]
      if (
        last &&
        !last.protected &&
        last.node.type.name === 'paragraph' &&
        last.node.content.size === 0
      ) {
        pos = last.pos
      } else {
        pos = editor.state.doc.content.size
      }
    } else {
      const target = findBlock(blocks, after)
      pos = target.pos + target.size
    }

    const ok = insertAt(editor, pos, content)
    if (!ok) throw new Error('Failed to insert blocks')
    return snapshotResult(editor, `Inserted ${content.length} block(s).`, title)
  }

  if (name === 'replaceBlock') {
    const id = String(params.id ?? '').trim().toLowerCase()
    if (!id) throw new Error('id is required')
    const target = findBlock(blocks, id)
    assertEditable(target, 'replace')

    let content = contentFromParams(params, false)
    if (content.length === 0 && params.text !== undefined) {
      const text = String(params.text)
      const type = target.node.type.name
      if (type === 'heading') {
        content = [headingNode(Number(target.node.attrs.level) || 1, text)]
      } else if (type === 'codeBlock') {
        content = [
          {
            type: 'codeBlock',
            attrs: { language: target.node.attrs.language ?? 'javascript' },
            content: text ? [{ type: 'text', text }] : [],
          },
        ]
      } else if (type === 'blockquote') {
        content = [{ type: 'blockquote', content: [paragraphNode(text)] }]
      } else {
        content = [paragraphNode(text)]
      }
    }
    if (content.length === 0) throw new Error('Provide markdown, blocks, block, or text')

    const ok = replaceRange(editor, target.pos, target.pos + target.size, content)
    if (!ok) throw new Error('Failed to replace block')
    return snapshotResult(editor, `Replaced ${id}.`, title)
  }

  if (name === 'replaceBlocks') {
    const fromId = String(params.fromId ?? params.from ?? '').trim().toLowerCase()
    const toId = String(params.toId ?? params.to ?? fromId).trim().toLowerCase()
    if (!fromId) throw new Error('fromId is required')

    const start = findBlock(blocks, fromId)
    const end = findBlock(blocks, toId)
    const fromPos = Math.min(start.pos, end.pos)
    const toPos = Math.max(start.pos + start.size, end.pos + end.size)

    const range = blocks.filter((block) => block.pos >= fromPos && block.pos + block.size <= toPos)
    for (const block of range) assertEditable(block, 'replace')

    const content = contentFromParams(params)
    const ok = replaceRange(editor, fromPos, toPos, content)
    if (!ok) throw new Error('Failed to replace blocks')
    return snapshotResult(editor, `Replaced ${fromId}–${toId}.`, title)
  }

  if (name === 'deleteBlocks') {
    const ids = parseIdList(params.ids ?? params.id)
    if (ids.length === 0) throw new Error('ids is required')

    const targets = ids.map((id) => findBlock(blocks, id))
    for (const block of targets) assertEditable(block, 'delete')

    const sorted = [...targets].sort((a, b) => b.pos - a.pos)
    for (const block of sorted) {
      const ok = deleteRange(editor, block.pos, block.pos + block.size)
      if (!ok) throw new Error(`Failed to delete ${block.id}`)
    }
    ensureDocumentNotEmpty(editor)
    return snapshotResult(editor, `Deleted ${ids.join(', ')}.`, title)
  }

  throw new Error(`Unknown note tool: ${name}`)
}
