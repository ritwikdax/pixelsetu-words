import type { ChainedCommands, Editor } from '@tiptap/core'
import { normalizeUrl } from '../utils/url'

export type SlashCommandCategory = 'blocks' | 'lists' | 'inline' | 'tools'

export interface SlashCommand {
  id: string
  label: string
  description: string
  keywords: string[]
  icon: string
  category: SlashCommandCategory
  apply: (chain: ChainedCommands, editor: Editor) => ChainedCommands
}

export const SLASH_COMMAND_CATEGORIES: { id: SlashCommandCategory; label: string }[] = [
  { id: 'blocks', label: 'Basic blocks' },
  { id: 'tools', label: 'Tools' },
  { id: 'lists', label: 'Lists' },
  { id: 'inline', label: 'Inline' },
]

export const slashCommands: SlashCommand[] = [
  {
    id: 'paragraph',
    label: 'Paragraph',
    description: 'Plain text block',
    keywords: ['p', 'paragraph', 'text'],
    icon: '¶',
    category: 'blocks',
    apply: (chain) => chain.setParagraph(),
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title'],
    icon: 'H1',
    category: 'blocks',
    apply: (chain) => chain.setHeading({ level: 1 }),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    icon: 'H2',
    category: 'blocks',
    apply: (chain) => chain.setHeading({ level: 2 }),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: 'H3',
    category: 'blocks',
    apply: (chain) => chain.setHeading({ level: 3 }),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Capture a quote',
    keywords: ['blockquote', 'quote'],
    icon: '❝',
    category: 'blocks',
    apply: (chain) => chain.setBlockquote(),
  },
  {
    id: 'code-block',
    label: 'Code block',
    description: 'Syntax-highlighted code',
    keywords: ['pre', 'code', 'codeblock', 'snippet'],
    icon: '</>',
    category: 'blocks',
    apply: (chain) => chain.toggleCodeBlock({ language: 'javascript' }),
  },
  {
    id: 'todo',
    label: 'To-do',
    description: 'Track a task with a checkbox',
    keywords: ['todo', 'task', 'checkbox', 'check', 'todo-list'],
    icon: '☐',
    category: 'blocks',
    apply: (chain) => chain.insertTodoList(),
  },
  {
    id: 'curl',
    label: 'API request',
    description: 'Minimal HTTP client to test APIs',
    keywords: ['curl', 'api', 'http', 'fetch', 'request', 'rest'],
    icon: '⎋',
    category: 'tools',
    apply: (chain) => chain.insertCurlBlock(),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Month view with today highlighted',
    keywords: ['calendar', 'calender', 'month', 'date', 'dates'],
    icon: '▦',
    category: 'blocks',
    apply: (chain) => chain.insertCalendarBlock(),
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Rows and columns you can type in',
    keywords: ['table', 'grid', 'cells', 'spreadsheet'],
    icon: '⊞',
    category: 'blocks',
    apply: (chain) => chain.insertTableSetup(),
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Vertical events with time, title, and subtext',
    keywords: ['timeline', 'events', 'history', 'schedule', 'milestones'],
    icon: '⋮',
    category: 'blocks',
    apply: (chain) => chain.insertTimelineBlock(),
  },
  {
    id: 'excalidraw',
    label: 'Drawing',
    description: 'Sketch or diagram on a canvas',
    keywords: ['draw', 'diagram', 'excalidraw', 'sketch', 'whiteboard', 'canvas'],
    icon: '✎',
    category: 'tools',
    apply: (chain) => chain.insertExcalidrawBlock(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Visual separator',
    keywords: ['hr', 'divider', 'line', 'rule'],
    icon: '—',
    category: 'blocks',
    apply: (chain) => chain.setHorizontalRule(),
  },
  {
    id: 'bullet-list',
    label: 'Bullet list',
    description: 'Unordered list',
    keywords: ['ul', 'bullet', 'list'],
    icon: '•',
    category: 'lists',
    apply: (chain) => chain.toggleBulletList(),
  },
  {
    id: 'numbered-list',
    label: 'Numbered list',
    description: 'Ordered list',
    keywords: ['ol', 'numbered', 'ordered', 'list'],
    icon: '1.',
    category: 'lists',
    apply: (chain) => chain.toggleOrderedList(),
  },
  {
    id: 'list-item',
    label: 'List item',
    description: 'Add a list item',
    keywords: ['li', 'item', 'list'],
    icon: '▪',
    category: 'lists',
    apply: (chain, editor) => {
      if (editor.isActive('bulletList') || editor.isActive('orderedList')) {
        return chain
      }
      return chain.toggleBulletList()
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Strong emphasis',
    keywords: ['b', 'bold', 'strong'],
    icon: 'B',
    category: 'inline',
    apply: (chain) => chain.toggleBold(),
  },
  {
    id: 'italic',
    label: 'Italic',
    description: 'Emphasized text',
    keywords: ['i', 'italic', 'em'],
    icon: 'I',
    category: 'inline',
    apply: (chain) => chain.toggleItalic(),
  },
  {
    id: 'strikethrough',
    label: 'Strikethrough',
    description: 'Cross out text',
    keywords: ['s', 'strike', 'strikethrough', 'del'],
    icon: 'S',
    category: 'inline',
    apply: (chain) => chain.toggleStrike(),
  },
  {
    id: 'inline-code',
    label: 'Inline code',
    description: 'Monospace snippet',
    keywords: ['code', 'inline'],
    icon: '`',
    category: 'inline',
    apply: (chain) => chain.toggleCode(),
  },
  {
    id: 'link',
    label: 'Link',
    description: 'Add a hyperlink',
    keywords: ['a', 'link', 'url'],
    icon: '🔗',
    category: 'inline',
    apply: (chain, editor) => {
      const { from, to, empty } = editor.state.selection
      if (!empty) {
        const text = editor.state.doc.textBetween(from, to)
        const href = normalizeUrl(text) ?? 'https://'
        return chain.setLink({ href })
      }
      return chain.setLink({ href: 'https://' })
    },
  },
  {
    id: 'line-break',
    label: 'Line break',
    description: 'Soft line break',
    keywords: ['br', 'break', 'newline'],
    icon: '↵',
    category: 'inline',
    apply: (chain) => chain.setHardBreak(),
  },
]
