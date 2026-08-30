import type { Editor as TiptapEditor } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'
import { get } from 'node-emoji'
import { customEmojiGifs } from '../data/customEmojiGifs'

export const EMOJI_PICKER_COLS = 8
export const EMOJI_PICKER_TRIGGER = /::([a-z0-9_+-]*)$/i

const POPULAR_SHORTCODES = [
  'smile',
  'joy',
  'laughing',
  'wink',
  'blush',
  'heart',
  'broken_heart',
  'thumbsup',
  'thumbsdown',
  'clap',
  'wave',
  'fire',
  'rocket',
  'eyes',
  'thinking',
  'sob',
  'angry',
  'tada',
  '100',
  'ok_hand',
  'raised_hands',
  'pray',
  'muscle',
  'star',
  'sparkles',
  'sunny',
  'rainbow',
  'cat',
  'dog',
  'coffee',
  'beer',
  'pizza',
  'cake',
  'partying_face',
  'sweat_smile',
  'cry',
  'flushed',
  'sunglasses',
  'heart_eyes',
  'kissing_heart',
  'hugging_face',
  'relieved',
  'sleeping',
  'zipper_mouth_face',
  'money_mouth_face',
  'nerd_face',
  'ghost',
  'skull',
  'poop',
  'clown_face',
] as const

export interface EmojiPickerItem {
  id: string
  shortcode: string
  label: string
  type: 'unicode' | 'gif'
  preview: string
}

export interface EmojiPickerContext {
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
    parentStart: $pos.start(),
    offset: $pos.parentOffset,
    text: $pos.parent.textContent,
  }
}

function getLineTextBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const lineBreak = before.lastIndexOf('\n')
  return lineBreak === -1 ? before : before.slice(lineBreak + 1)
}

const gifPickerItems: EmojiPickerItem[] = Object.entries(customEmojiGifs).map(([shortcode, src]) => ({
  id: `gif-${shortcode}`,
  shortcode,
  label: shortcode.replace(/_/g, ' '),
  type: 'gif' as const,
  preview: src,
}))

const popularUnicodeItems: EmojiPickerItem[] = POPULAR_SHORTCODES.flatMap((shortcode) => {
  const preview = get(shortcode)
  if (!preview) return []
  return [
    {
      id: `uni-${shortcode}`,
      shortcode,
      label: shortcode.replace(/_/g, ' '),
      type: 'unicode' as const,
      preview,
    },
  ]
})

function matchesQuery(item: EmojiPickerItem, query: string): boolean {
  if (!query) return true
  const haystack = `${item.shortcode} ${item.label}`.toLowerCase()
  return haystack.includes(query)
}

export function searchEmojiPickerItems(query: string, limit = 48): EmojiPickerItem[] {
  const normalized = query.toLowerCase().trim()

  if (!normalized) {
    return [...gifPickerItems, ...popularUnicodeItems].slice(0, limit)
  }

  const gifs = gifPickerItems.filter((item) => matchesQuery(item, normalized))
  const unicode = popularUnicodeItems.filter((item) => matchesQuery(item, normalized))

  return [...gifs, ...unicode].slice(0, limit)
}

export function getEmojiPickerContext(state: EditorState): EmojiPickerContext | null {
  const ctx = getTextblockContext(state)
  if (!ctx) return null

  const line = getLineTextBeforeCursor(ctx.text, ctx.offset)
  const match = line.match(EMOJI_PICKER_TRIGGER)
  if (!match) return null

  const query = match[1] ?? ''
  const triggerLength = match[0].length
  const from = ctx.from - triggerLength
  const to = ctx.from

  return { query, from, to }
}

export function isEmojiPickerActive(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return EMOJI_PICKER_TRIGGER.test(line)
}

export function insertEmojiPickerItem(
  editor: TiptapEditor,
  item: EmojiPickerItem,
  from: number,
  to: number,
): void {
  if (item.type === 'unicode') {
    editor.chain().focus().insertContentAt({ from, to }, `${item.preview} `).run()
    return
  }

  editor
    .chain()
    .focus()
    .insertContentAt({ from, to }, [
      {
        type: 'image',
        attrs: {
          src: item.preview,
          alt: `:${item.shortcode}:`,
          title: item.shortcode,
        },
      },
      { type: 'text', text: ' ' },
    ])
    .run()
}
