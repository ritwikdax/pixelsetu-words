const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export interface ParsedCurlCommand {
  method: string
  url: string
  headers: Record<string, string>
  body: string
}

function tokenizeShell(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index]!

    if (quote) {
      if (ch === quote) {
        quote = null
        tokens.push(current)
        current = ''
      } else if (ch === '\\' && quote === '"' && index + 1 < input.length) {
        index += 1
        current += input[index]!
      } else {
        current += ch
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      if (current.trim()) {
        tokens.push(current.trim())
        current = ''
      }
      quote = ch
      continue
    }

    if (/\s/.test(ch)) {
      if (current.trim()) {
        tokens.push(current.trim())
        current = ''
      }
      continue
    }

    current += ch
  }

  if (current.trim()) tokens.push(current.trim())
  return tokens
}

function isUrl(token: string): boolean {
  return /^https?:\/\//i.test(token)
}

const BODY_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'])

const SKIP_VALUE_FLAGS = new Set(['-u', '--user'])

function setHeader(headers: Record<string, string>, name: string, value: string) {
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name.toLowerCase())
  if (key) {
    headers[key] = value
    return
  }
  headers[name] = value
}

function appendCookie(headers: Record<string, string>, cookie: string) {
  const existingKey = Object.keys(headers).find((entry) => entry.toLowerCase() === 'cookie')
  if (existingKey) {
    headers[existingKey] = `${headers[existingKey]}; ${cookie}`
    return
  }
  headers.Cookie = cookie
}

export function parseCurlCommand(input: string): ParsedCurlCommand {
  let text = input.trim()
  if (!text) {
    throw new Error('Paste a curl command to continue.')
  }

  text = text.replace(/\\\s*\r?\n\s*/g, ' ')

  if (!/^curl\b/i.test(text)) {
    throw new Error('Command must start with curl.')
  }

  text = text.replace(/^curl\s+/i, '')
  const tokens = tokenizeShell(text)

  let method = 'GET'
  const headers: Record<string, string> = {}
  let body = ''
  let url = ''

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!

    if (token === '-X' || token === '--request') {
      const next = tokens[++index]
      if (!next) throw new Error('Missing HTTP method after -X.')
      method = next.toUpperCase()
      continue
    }

    if (token === '-H' || token === '--header') {
      const header = tokens[++index]
      if (!header) throw new Error('Missing value for header flag.')
      const colon = header.indexOf(':')
      if (colon === -1) throw new Error(`Invalid header: ${header}`)
      setHeader(headers, header.slice(0, colon).trim(), header.slice(colon + 1).trim())
      continue
    }

    if (token === '--url') {
      const next = tokens[++index]
      if (!next) throw new Error('Missing value for --url.')
      url = next
      continue
    }

    if (token === '-b' || token === '--cookie') {
      const cookie = tokens[++index]
      if (!cookie) throw new Error('Missing value for cookie flag.')
      appendCookie(headers, cookie)
      continue
    }

    if (token === '-A' || token === '--user-agent') {
      const userAgent = tokens[++index]
      if (!userAgent) throw new Error('Missing value for user-agent flag.')
      setHeader(headers, 'User-Agent', userAgent)
      continue
    }

    if (token === '-e' || token === '--referer') {
      const referer = tokens[++index]
      if (!referer) throw new Error('Missing value for referer flag.')
      setHeader(headers, 'Referer', referer)
      continue
    }

    if (BODY_FLAGS.has(token)) {
      body = tokens[++index] ?? ''
      if (method === 'GET') method = 'POST'
      continue
    }

    if (token === '-G' || token === '--get') {
      method = 'GET'
      continue
    }

    if (isUrl(token)) {
      url = token
      continue
    }

    if (token.startsWith('-')) {
      if (SKIP_VALUE_FLAGS.has(token)) {
        index += 1
      }
      continue
    }
  }

  if (!url) {
    throw new Error('Could not find a URL in the curl command.')
  }

  if (!HTTP_METHODS.has(method)) {
    throw new Error(`Unsupported HTTP method: ${method}`)
  }

  return { method, url, headers, body }
}
