export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent
  return /Mac|iPhone|iPad|iPod/i.test(platform)
}

export function formatShortcutDisplay(keys: string): string {
  if (!isMacPlatform()) return keys

  return keys
    .replace(/\bCtrl\b/g, '⌘')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bShift\b/g, '⇧')
}

function expandAlternatives(keys: string): string[] {
  const slashMatch = keys.match(/\s+\/\s+/)
  if (!slashMatch || slashMatch.index === undefined) return [keys]

  const left = keys.slice(0, slashMatch.index).trim()
  const right = keys.slice(slashMatch.index + slashMatch[0].length).trim()

  if (right.includes('+')) return [left, right]

  const lastPlus = left.lastIndexOf(' + ')
  if (lastPlus === -1) return [left, right]

  const prefix = left.slice(0, lastPlus + 3)
  return [left, `${prefix}${right}`]
}

function splitChord(chord: string): string[] {
  return chord
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export interface ShortcutChord {
  keys: string[]
  joinWith?: 'then' | 'or'
}

export function parseShortcutKeys(keys: string): ShortcutChord[] {
  const formatted = formatShortcutDisplay(keys)
  const commaParts = formatted.split(/,\s*/)
  const chords: ShortcutChord[] = []

  commaParts.forEach((part, commaIndex) => {
    const variants = expandAlternatives(part)
    variants.forEach((variant, variantIndex) => {
      chords.push({
        keys: splitChord(variant),
        joinWith:
          variantIndex > 0 ? 'or' : commaIndex > 0 ? 'then' : undefined,
      })
    })
  })

  return chords
}

export function formatShortcutHint(keys: string): string {
  return parseShortcutKeys(keys)
    .map((chord) => chord.keys.join(''))
    .join(' ')
}
