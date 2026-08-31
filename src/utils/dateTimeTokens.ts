export type DateTimeKind = 'date' | 'time' | 'datetime'

export interface DateTimeToken {
  text: string
  start: number
  end: number
  kind: DateTimeKind
}

const MONTH_NAMES =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?'

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const DAY_NUM = '(?:0?[1-9]|[12]\\d|3[01])'
const DAY = `${DAY_NUM}(?:st|nd|rd|th)?`
const YEAR = '(?:,?\\s*\\d{4})'
const CLOCK = '(?:[01]?\\d|2[0-3]):[0-5]\\d(?:\\s*[AaPp][Mm])?'
const AMPM_TIME = '(?:1[0-2]|0?[1-9])(?:\\s*:\\s*[0-5]\\d)?\\s*[AaPp][Mm]'
const TIME = `(?:${CLOCK}|${AMPM_TIME})`
const TIME_TAIL = `(?:\\s*(?:,|@|(?:at))\\s*|\\s+)${TIME}`

const NAMED_DAY_MONTH = new RegExp(
  `\\b(?:the\\s+)?(${DAY})(?:\\s+of)?\\s+(${MONTH_NAMES})(${YEAR})?(${TIME_TAIL})?\\b`,
  'gi',
)

const NAMED_MONTH_DAY = new RegExp(
  `\\b(${MONTH_NAMES})\\s+(${DAY})(${YEAR})?(${TIME_TAIL})?\\b`,
  'gi',
)

const ISO_PATTERN =
  /\b(\d{4})-(\d{2})-(\d{2})(?:[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[AaPp][Mm])?))?\b/g

const NUMERIC_DATE = new RegExp(
  `\\b(${DAY_NUM})([/-])(${DAY_NUM})\\2(\\d{4})(${TIME_TAIL})?\\b`,
  'g',
)

const TIME_ONLY = new RegExp(`\\b(${TIME})\\b`, 'gi')

function monthFromName(name: string): number | null {
  const index = MONTH_INDEX[name.toLowerCase()]
  return index === undefined ? null : index
}

function parseDay(raw: string): { day: number; ordinal: string } | null {
  const match = raw.trim().match(/^(\d{1,2})(st|nd|rd|th)?$/i)
  if (!match) return null
  const day = Number(match[1])
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return { day, ordinal: (match[2] ?? '').toLowerCase() }
}

function ordinalMatches(day: number, suffix: string): boolean {
  if (!suffix) return true
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return suffix === 'th'
  const mod10 = day % 10
  if (mod10 === 1) return suffix === 'st'
  if (mod10 === 2) return suffix === 'nd'
  if (mod10 === 3) return suffix === 'rd'
  return suffix === 'th'
}

function isValidYmd(year: number, monthIndex: number, day: number): boolean {
  const date = new Date(year, monthIndex, day)
  return (
    date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day
  )
}

function monthHasDay(monthIndex: number, day: number): boolean {
  return isValidYmd(2024, monthIndex, day)
}

function parseYear(raw: string | undefined, monthIndex: number, day: number): number | null {
  const trimmed = raw?.replace(/[,\s]/g, '') ?? ''
  if (trimmed) {
    const year = Number(trimmed)
    if (!Number.isInteger(year) || year < 1000 || year > 9999) return null
    return isValidYmd(year, monthIndex, day) ? year : null
  }
  return monthHasDay(monthIndex, day) ? new Date().getFullYear() : null
}

function hasTimePart(raw: string | undefined): boolean {
  return Boolean(raw && raw.trim())
}

function looksLikeUrlPath(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''
  return before === '/' || after === '/' || before === '?' || before === '='
}

function addMatch(
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
  start: number,
  end: number,
  kind: DateTimeKind,
) {
  matches.push({ start, end, kind })
}

function collectNamed(
  text: string,
  pattern: RegExp,
  dayGroup: number,
  monthGroup: number,
  yearGroup: number,
  timeGroup: number,
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
) {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const dayParts = parseDay(match[dayGroup] ?? '')
    const monthIndex = monthFromName(match[monthGroup] ?? '')
    if (!dayParts || monthIndex === null) continue
    if (!ordinalMatches(dayParts.day, dayParts.ordinal)) continue
    if (parseYear(match[yearGroup], monthIndex, dayParts.day) === null) continue
    const prefix = match[0].match(/^(?:the\s+)/i)?.[0].length ?? 0
    if (looksLikeUrlPath(text, match.index, match.index + match[0].length)) continue
    addMatch(
      matches,
      match.index + prefix,
      match.index + match[0].length,
      hasTimePart(match[timeGroup]) ? 'datetime' : 'date',
    )
  }
}

function collectIso(
  text: string,
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
) {
  ISO_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ISO_PATTERN.exec(text)) !== null) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (!isValidYmd(year, month - 1, day)) continue
    if (looksLikeUrlPath(text, match.index, match.index + match[0].length)) continue
    addMatch(
      matches,
      match.index,
      match.index + match[0].length,
      match[4] ? 'datetime' : 'date',
    )
  }
}

function collectNumeric(
  text: string,
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
) {
  NUMERIC_DATE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = NUMERIC_DATE.exec(text)) !== null) {
    const a = Number(match[1])
    const b = Number(match[3])
    const year = Number(match[4])
    const dmy = isValidYmd(year, b - 1, a)
    const mdy = isValidYmd(year, a - 1, b)
    if (!dmy && !mdy) continue
    if (looksLikeUrlPath(text, match.index, match.index + match[0].length)) continue
    addMatch(
      matches,
      match.index,
      match.index + match[0].length,
      hasTimePart(match[5]) ? 'datetime' : 'date',
    )
  }
}

function collectTimeOnly(
  text: string,
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
) {
  TIME_ONLY.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TIME_ONLY.exec(text)) !== null) {
    if (looksLikeUrlPath(text, match.index, match.index + match[0].length)) continue
    addMatch(matches, match.index, match.index + match[0].length, 'time')
  }
}

function removeOverlaps(
  matches: Array<{ start: number; end: number; kind: DateTimeKind }>,
): Array<{ start: number; end: number; kind: DateTimeKind }> {
  const sorted = [...matches].sort(
    (a, b) => a.start - b.start || b.end - a.end - (a.end - a.start),
  )
  const result: Array<{ start: number; end: number; kind: DateTimeKind }> = []

  for (const match of sorted) {
    const last = result[result.length - 1]
    if (last && match.start < last.end) continue
    result.push(match)
  }

  return result
}

export function findDateTimeTokens(text: string): DateTimeToken[] {
  const raw: Array<{ start: number; end: number; kind: DateTimeKind }> = []

  collectNamed(text, NAMED_DAY_MONTH, 1, 2, 3, 4, raw)
  collectNamed(text, NAMED_MONTH_DAY, 2, 1, 3, 4, raw)
  collectIso(text, raw)
  collectNumeric(text, raw)
  collectTimeOnly(text, raw)

  return removeOverlaps(raw).map((match) => ({
    text: text.slice(match.start, match.end),
    start: match.start,
    end: match.end,
    kind: match.kind,
  }))
}
