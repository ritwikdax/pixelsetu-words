import { get, has } from 'node-emoji'
import { customEmojiGifAliases, customEmojiGifs } from '../data/customEmojiGifs'

export const EMOJI_SHORTCODE_PATTERN = /:([a-z0-9_+-]+)$/i

function getLineTextBeforeCursor(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const lineBreak = before.lastIndexOf('\n')
  return lineBreak === -1 ? before : before.slice(lineBreak + 1)
}

export type ResolvedEmoji =
  | { type: 'unicode'; value: string }
  | { type: 'gif'; src: string; shortcode: string }

function normalizeShortcode(name: string): string {
  return name.toLowerCase().replace(/^:+|:+$/g, '')
}

function resolveGifShortcode(name: string): string | null {
  const normalized = normalizeShortcode(name)
  const aliased = customEmojiGifAliases[normalized] ?? normalized
  return customEmojiGifs[aliased] ? aliased : null
}

export function resolveEmojiShortcode(name: string): ResolvedEmoji | null {
  const normalized = normalizeShortcode(name)
  if (!normalized) return null

  const gifKey = resolveGifShortcode(normalized)
  if (gifKey) {
    return {
      type: 'gif',
      src: customEmojiGifs[gifKey]!,
      shortcode: gifKey,
    }
  }

  if (has(normalized)) {
    const value = get(normalized)
    if (value) {
      return { type: 'unicode', value }
    }
  }

  return null
}

export function isTypingEmojiShortcode(text: string, offset: number): boolean {
  const line = getLineTextBeforeCursor(text, offset)
  return EMOJI_SHORTCODE_PATTERN.test(line)
}
