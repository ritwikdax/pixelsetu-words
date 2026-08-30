export interface ColorToken {
  text: string
  start: number
  end: number
  css: string
}

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g
const FUNCTION_PATTERN =
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/gi

const CSS_COLOR_NAMES = new Set([
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'transparent',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
])

const resolvedColorCache = new Map<string, string | null>()

export function resolveCssColor(value: string): string | null {
  const input = value.trim()
  if (!input) return null

  if (resolvedColorCache.has(input)) {
    return resolvedColorCache.get(input) ?? null
  }

  if (typeof document === 'undefined') {
    if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(input)) return input
    return CSS_COLOR_NAMES.has(input.toLowerCase()) ? input : null
  }

  const el = document.createElement('div')
  el.style.color = input
  const resolved = el.style.color

  if (!resolved) {
    resolvedColorCache.set(input, null)
    return null
  }

  resolvedColorCache.set(input, resolved)
  return resolved
}

function addPatternMatches(
  text: string,
  pattern: RegExp,
  matches: Array<{ start: number; end: number; text: string }>,
) {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    })
  }
}

function addNamedColorMatches(
  text: string,
  matches: Array<{ start: number; end: number; text: string }>,
) {
  const wordPattern = /\b[a-zA-Z]+\b/g
  let match: RegExpExecArray | null
  while ((match = wordPattern.exec(text)) !== null) {
    const word = match[0]
    if (!CSS_COLOR_NAMES.has(word.toLowerCase())) continue
    matches.push({
      start: match.index,
      end: match.index + word.length,
      text: word,
    })
  }
}

function removeOverlaps(
  matches: Array<{ start: number; end: number; text: string }>,
): Array<{ start: number; end: number; text: string }> {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start))
  const result: Array<{ start: number; end: number; text: string }> = []

  for (const match of sorted) {
    const last = result[result.length - 1]
    if (last && match.start < last.end) continue
    result.push(match)
  }

  return result
}

export function findColorTokens(text: string): ColorToken[] {
  const rawMatches: Array<{ start: number; end: number; text: string }> = []

  addPatternMatches(text, HEX_PATTERN, rawMatches)
  addPatternMatches(text, FUNCTION_PATTERN, rawMatches)
  addNamedColorMatches(text, rawMatches)

  const tokens: ColorToken[] = []

  for (const match of removeOverlaps(rawMatches)) {
    const css = resolveCssColor(match.text)
    if (!css) continue
    tokens.push({
      text: match.text,
      start: match.start,
      end: match.end,
      css,
    })
  }

  return tokens
}
