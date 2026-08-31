import type { Editor as TiptapEditor } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'
import {
  slashCommands,
  type SlashCommand,
  type SlashCommandCategory,
} from '../data/slashCommands'
import { focusCalendarSetupSelect } from './focusCalendarSetup'
import { focusCurlSetupInput } from './focusCurlSetup'
import { openLatestExcalidrawEditor } from './focusExcalidrawSetup'
import { focusTimelineFirstInput } from './focusTimelineInput'

export const SLASH_COMMAND_TRIGGER = /(?:^|\s)\/([a-z0-9-]*)$/i

export interface SlashCommandPickerItem {
  command: SlashCommand
}

export interface SlashCommandPickerContext {
  query: string
  from: number
  to: number
}

function getTextblockContext(state: EditorState) {
  const { from } = state.selection
  if (!state.selection.empty) return null

  const $pos = state.doc.resolve(from)
  if (!$pos.parent.isTextblock) return null

  return {
    from,
    offset: $pos.parentOffset,
    text: $pos.parent.textContent,
  }
}

function getLineTextBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const lineBreak = before.lastIndexOf('\n')
  return lineBreak === -1 ? before : before.slice(lineBreak + 1)
}

function commandSearchText(command: SlashCommand): string {
  return [command.label, command.description, ...command.keywords].join(' ').toLowerCase()
}

function matchesQuery(command: SlashCommand, query: string): boolean {
  if (!query) return true
  const haystack = commandSearchText(command)
  if (haystack.includes(query)) return true
  return command.keywords.some((keyword) => keyword.startsWith(query))
}

function compareCommands(a: SlashCommand, b: SlashCommand, query: string): number {
  if (!query) {
    const categoryOrder = (command: SlashCommand) => {
      if (command.category === 'blocks') return 0
      if (command.category === 'tools') return 1
      if (command.category === 'lists') return 2
      return 3
    }
    const categoryDiff = categoryOrder(a) - categoryOrder(b)
    if (categoryDiff !== 0) return categoryDiff
    return slashCommands.indexOf(a) - slashCommands.indexOf(b)
  }

  const aKeyword = a.keywords.find((keyword) => keyword.startsWith(query))
  const bKeyword = b.keywords.find((keyword) => keyword.startsWith(query))
  if (aKeyword && !bKeyword) return -1
  if (!aKeyword && bKeyword) return 1
  if (aKeyword && bKeyword) return aKeyword.localeCompare(bKeyword)
  return a.label.localeCompare(b.label)
}

export function searchSlashCommands(query: string, limit = 16): SlashCommandPickerItem[] {
  const normalized = query.toLowerCase().trim()
  return slashCommands
    .filter((command) => matchesQuery(command, normalized))
    .sort((a, b) => compareCommands(a, b, normalized))
    .slice(0, limit)
    .map((command) => ({ command }))
}

export function getSlashCommandPickerContext(state: EditorState): SlashCommandPickerContext | null {
  const ctx = getTextblockContext(state)
  if (!ctx) return null

  const line = getLineTextBeforeCursor(ctx.text, ctx.offset)
  const match = line.match(SLASH_COMMAND_TRIGGER)
  if (!match) return null

  const fullMatch = match[0]
  const slashOffsetInMatch = fullMatch.indexOf('/')
  const triggerLength = fullMatch.length - slashOffsetInMatch
  const from = ctx.from - triggerLength
  const to = ctx.from

  return {
    query: match[1] ?? '',
    from,
    to,
  }
}

export function isSlashCommandActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return SLASH_COMMAND_TRIGGER.test(line)
}

export function insertSlashCommand(
  editor: TiptapEditor,
  command: SlashCommand,
  from: number,
  to: number,
): void {
  if (command.id === 'curl') {
    const inserted = editor.chain().deleteRange({ from, to }).insertCurlBlock().run()
    if (inserted) {
      queueMicrotask(() => focusCurlSetupInput(editor))
    }
    return
  }

  if (command.id === 'calendar') {
    const inserted = editor.chain().deleteRange({ from, to }).insertCalendarBlock().run()
    if (inserted) {
      queueMicrotask(() => focusCalendarSetupSelect(editor))
    }
    return
  }

  if (command.id === 'timeline') {
    const inserted = editor.chain().deleteRange({ from, to }).insertTimelineBlock().run()
    if (inserted) {
      queueMicrotask(() => focusTimelineFirstInput(editor))
    }
    return
  }

  if (command.id === 'excalidraw') {
    const inserted = editor.chain().deleteRange({ from, to }).insertExcalidrawBlock().run()
    if (inserted) {
      queueMicrotask(() => openLatestExcalidrawEditor(editor))
    }
    return
  }

  const chain = editor.chain().focus().deleteRange({ from, to })
  command.apply(chain, editor).run()
}

function slashCommandCategoryLabel(category: SlashCommandCategory): string {
  if (category === 'blocks') return 'Basic blocks'
  if (category === 'tools') return 'Tools'
  if (category === 'lists') return 'Lists'
  return 'Inline'
}

export function groupSlashCommandItems(
  items: SlashCommandPickerItem[],
): { category: SlashCommandCategory; label: string; items: SlashCommandPickerItem[] }[] {
  const groups: { category: SlashCommandCategory; label: string; items: SlashCommandPickerItem[] }[] = []

  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.category === item.command.category) {
      last.items.push(item)
      continue
    }

    groups.push({
      category: item.command.category,
      label: slashCommandCategoryLabel(item.command.category),
      items: [item],
    })
  }

  return groups
}
