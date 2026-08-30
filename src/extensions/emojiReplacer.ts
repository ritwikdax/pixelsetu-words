import { Extension, InputRule } from '@tiptap/core'
import { resolveEmojiShortcode } from '../utils/emojiShortcode'

const SHORTCODE_NAME = '([a-z0-9_+-]+)'

function replaceShortcode(
  state: Parameters<InputRule['handler']>[0]['state'],
  range: { from: number; to: number },
  match: RegExpMatchArray,
): boolean {
  const shortcode = match[1]
  if (!shortcode) return false

  const resolved = resolveEmojiShortcode(shortcode)
  if (!resolved) return false

  const { tr, schema } = state
  const fullMatch = match[0] ?? ''
  const trailingSpace = fullMatch.endsWith(' ') ? ' ' : ''
  const replaceTo = trailingSpace ? range.to - 1 : range.to

  if (resolved.type === 'unicode') {
    tr.insertText(resolved.value + trailingSpace, range.from, range.to)
    return true
  }

  const imageType = schema.nodes.image
  if (!imageType) return false

  const image = imageType.create({
    src: resolved.src,
    alt: `:${resolved.shortcode}:`,
    title: resolved.shortcode,
  })

  tr.replaceWith(range.from, replaceTo, image)

  if (trailingSpace) {
    const insertPos = range.from + image.nodeSize
    tr.insertText(' ', insertPos)
  }

  return true
}

function createShortcodeRule(pattern: RegExp): InputRule {
  return new InputRule({
    find: pattern,
    handler: ({ state, range, match }) => {
      if (!replaceShortcode(state, range, match)) {
        return null
      }
    },
  })
}

export const EmojiReplacer = Extension.create({
  name: 'emojiReplacer',

  addInputRules() {
    return [
      createShortcodeRule(new RegExp(`:${SHORTCODE_NAME}:$`)),
      createShortcodeRule(new RegExp(`:${SHORTCODE_NAME}\\s$`)),
    ]
  },
})
