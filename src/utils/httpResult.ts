export const HTTP_RESULT_MAX_BODY = 80_000
export const HTTP_RESULT_MAX_ROWS = 50
export const HTTP_RESULT_MAX_DEPTH = 5

export interface HttpResultPayload {
  url: string
  status: number
  statusText: string
  contentType: string
  body: string
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isObjectRecordArray(value: unknown[]): value is Record<string, unknown>[] {
  return value.length > 0 && value.every((item) => isPlainObject(item))
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export type ScalarKind = 'empty' | 'bool' | 'number' | 'url' | 'date' | 'text'

export interface FormattedScalar {
  kind: ScalarKind
  text: string
  href?: string
}

export function formatScalar(value: unknown): FormattedScalar {
  if (value === null || value === undefined || value === '') {
    return { kind: 'empty', text: '—' }
  }
  if (typeof value === 'boolean') {
    return { kind: 'bool', text: value ? 'Yes' : 'No' }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'number', text: String(value) }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) {
      return { kind: 'url', text: trimmed, href: trimmed }
    }
    if (ISO_DATE.test(trimmed)) {
      const parsed = new Date(trimmed)
      if (!Number.isNaN(parsed.getTime())) {
        const hasTime = /T|\d{2}:\d{2}/.test(trimmed)
        return {
          kind: 'date',
          text: hasTime ? parsed.toLocaleString() : parsed.toLocaleDateString(),
        }
      }
    }
    return { kind: 'text', text: value }
  }
  return { kind: 'text', text: String(value) }
}

export function parseHttpResultBody(body: string, contentType: string): unknown {
  const trimmed = body.trim()
  if (!trimmed) return null

  const looksJson =
    contentType.includes('json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')

  if (looksJson) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      /* fall through */
    }
  }

  if (contentType.includes('html') || /<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    const text = stripHtml(trimmed)
    return text ? { Content: text } : trimmed
  }

  return trimmed
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateBody(text: string): string {
  if (text.length <= HTTP_RESULT_MAX_BODY) return text
  return `${text.slice(0, HTTP_RESULT_MAX_BODY)}\n\n[truncated]`
}

function describeShape(value: unknown): string {
  if (value === null || value === undefined) return 'empty'
  if (Array.isArray(value)) {
    if (isObjectRecordArray(value)) {
      const keys = [...new Set(value.flatMap((row) => Object.keys(row)))]
      return `table of ${value.length} row${value.length === 1 ? '' : 's'} (${keys.slice(0, 8).join(', ')})`
    }
    return `list of ${value.length} item${value.length === 1 ? '' : 's'}`
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    return `object with ${keys.length} field${keys.length === 1 ? '' : 's'} (${keys.slice(0, 10).join(', ')})`
  }
  return typeof value
}

export function summarizeHttpResult(parsed: unknown): string {
  const preview = compactPreview(parsed)
  return [
    'The readable card is already on the page.',
    `Contents: ${describeShape(parsed)}`,
    preview ? `Preview: ${preview}` : '',
    'Reply with a short confirmation. Do not call fetchUrl again. Do not mention HTTP, status codes, or the URL.',
  ]
    .filter(Boolean)
    .join('\n')
}

function compactPreview(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    if (isObjectRecordArray(value)) {
      const first = value[0]
      const keys = first ? Object.keys(first).slice(0, 6).join(', ') : ''
      return `${value.length} rows${keys ? `; columns ${keys}` : ''}`
    }
    return `${value.length} items`
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .slice(0, 8)
      .map(([key, entry]) => {
        if (isPlainObject(entry) || Array.isArray(entry)) {
          return `${humanizeKey(key)}: ${describeShape(entry)}`
        }
        return `${humanizeKey(key)}: ${formatScalar(entry).text}`
      })
      .join('; ')
  }
  return formatScalar(value).text.slice(0, 240)
}

async function readResponse(response: Response, url: string): Promise<HttpResultPayload> {
  const contentType = response.headers.get('content-type') ?? ''
  const body = truncateBody(await response.text())
  return {
    url,
    status: response.status,
    statusText: response.statusText || (response.ok ? 'OK' : 'Error'),
    contentType,
    body,
  }
}

const fetchByUrl = new Map<string, Promise<HttpResultPayload>>()

async function fetchHttpResultOnce(trimmed: string): Promise<HttpResultPayload> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), 20_000)

  try {
    try {
      const response = await fetch(trimmed, {
        method: 'GET',
        signal: controller.signal,
      })
      return await readResponse(response, trimmed)
    } catch (error) {
      const fallback = await fetch(`https://r.jina.ai/${trimmed}`, {
        method: 'GET',
        signal: controller.signal,
      })
      if (!fallback.ok) {
        const reason = error instanceof Error ? error.message : 'network error'
        throw new Error(`Failed to GET URL (${reason})`)
      }
      return await readResponse(fallback, trimmed)
    }
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export async function fetchHttpResult(url: string): Promise<HttpResultPayload> {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('url must start with http:// or https://')
  }

  const cached = fetchByUrl.get(trimmed)
  if (cached) return cached

  const pending = fetchHttpResultOnce(trimmed).catch((error: unknown) => {
    fetchByUrl.delete(trimmed)
    throw error
  })
  fetchByUrl.set(trimmed, pending)
  return pending
}
