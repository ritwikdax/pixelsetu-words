import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { parseCurlCommand } from '../../utils/parseCurlCommand'
import { focusElement, focusCurlUrlInput } from '../../utils/focusCurlSetup'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

type HttpMethod = (typeof HTTP_METHODS)[number]

interface CurlBlockAttrs {
  method: HttpMethod
  url: string
  headers: string
  body: string
  configured: boolean
}

const CURL_PLACEHOLDER = `curl -X POST https://api.example.com/users \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Ada"}'`

function parseHeaders(raw: string): Record<string, string> {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object')
  }
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      headers[key] = value
    } else if (value != null) {
      headers[key] = String(value)
    }
  }
  return headers
}

function formatJsonText(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return raw
  }
}

function formatResponseBody(body: string, contentType: string | null): string {
  if (contentType?.includes('application/json')) {
    return formatJsonText(body)
  }
  return body
}

function hasJsonContent(raw: string): boolean {
  return raw.trim().length > 0 && raw.trim() !== '{}'
}

export function CurlBlockView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const attrs = node.attrs as CurlBlockAttrs
  const setupInputRef = useRef<HTMLTextAreaElement>(null)
  const wasSetupRef = useRef(!attrs.configured)
  const [curlInput, setCurlInput] = useState('')
  const [urlDraft, setUrlDraft] = useState(attrs.url)
  const [headersDraft, setHeadersDraft] = useState(attrs.headers)
  const [bodyDraft, setBodyDraft] = useState(attrs.body)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [responseBody, setResponseBody] = useState<string | null>(null)

  const isSetup = !attrs.configured

  useEffect(() => {
    setUrlDraft(attrs.url)
  }, [attrs.url])

  useEffect(() => {
    setHeadersDraft(attrs.headers)
  }, [attrs.headers])

  useEffect(() => {
    setBodyDraft(attrs.body)
  }, [attrs.body])

  useLayoutEffect(() => {
    if (!isSetup) return
    const field = setupInputRef.current
    if (!field) return
    focusElement(editor, field)
  }, [isSetup, editor])

  useLayoutEffect(() => {
    if (wasSetupRef.current && !isSetup) {
      focusCurlUrlInput(editor)
    }
    wasSetupRef.current = isSetup
  }, [isSetup, editor])

  const showBody = ['POST', 'PUT', 'PATCH'].includes(attrs.method)
  const showHeaders = hasJsonContent(headersDraft)

  const headersRows = useMemo(() => {
    const lines = headersDraft.split('\n').length
    return Math.min(Math.max(lines, 3), 12)
  }, [headersDraft])

  const bodyRows = useMemo(() => {
    const lines = bodyDraft.split('\n').length
    return Math.min(Math.max(lines, 4), 16)
  }, [bodyDraft])

  const handleLoadCurl = useCallback(() => {
    setSetupError(null)
    try {
      const parsed = parseCurlCommand(curlInput)
      const headers =
        Object.keys(parsed.headers).length > 0
          ? JSON.stringify(parsed.headers, null, 2)
          : '{}'
      const body = parsed.body ? formatJsonText(parsed.body) : ''

      updateAttributes({
        method: parsed.method,
        url: parsed.url,
        headers,
        body,
        configured: true,
      })
      setCurlInput('')
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not parse curl command.')
    }
  }, [curlInput, updateAttributes])

  const handleSend = useCallback(async () => {
    const url = urlDraft.trim()
    if (!url) {
      setError('Add a URL to run this request.')
      setStatusLine(null)
      setResponseBody(null)
      return
    }

    if (url !== attrs.url) {
      updateAttributes({ url })
    }

    setLoading(true)
    setError(null)
    setStatusLine(null)
    setResponseBody(null)

    try {
      const headers = parseHeaders(headersDraft)
      const options: RequestInit = { method: attrs.method, headers }

      if (showBody && bodyDraft.trim()) {
        options.body = bodyDraft
        if (!headers['Content-Type'] && !headers['content-type']) {
          options.headers = { ...headers, 'Content-Type': 'application/json' }
        }
      }

      const started = performance.now()
      const response = await fetch(url, options)
      const elapsed = Math.round(performance.now() - started)
      const rawBody = await response.text()
      const formatted = formatResponseBody(rawBody, response.headers.get('content-type'))

      setStatusLine(`${response.status} ${response.statusText} · ${elapsed}ms`)
      setResponseBody(formatted || '{}')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setError(
        message.includes('Failed to fetch')
          ? 'Request blocked (network/CORS). Try a CORS-enabled API or a local endpoint.'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }, [
    attrs.method,
    attrs.url,
    bodyDraft,
    headersDraft,
    showBody,
    updateAttributes,
    urlDraft,
  ])

  const stopPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  const formatHeadersOnBlur = () => {
    if (!headersDraft.trim()) return
    const formatted = formatJsonText(headersDraft)
    setHeadersDraft(formatted)
    updateAttributes({ headers: formatted })
  }

  const formatBodyOnBlur = () => {
    if (!bodyDraft.trim()) return
    const formatted = formatJsonText(bodyDraft)
    setBodyDraft(formatted)
    updateAttributes({ body: formatted })
  }

  const syncUrlOnBlur = () => {
    if (urlDraft !== attrs.url) {
      updateAttributes({ url: urlDraft })
    }
  }

  if (isSetup) {
    return (
      <NodeViewWrapper
        as="div"
        className={`curl-block curl-block-setup ${selected ? 'is-selected' : ''}`}
        contentEditable={false}
        data-curl-block=""
        data-configured="false"
      >
        <p className="curl-block-section-label">Paste a curl command</p>
        <pre className="curl-block-code">
          <code>
            <textarea
              ref={setupInputRef}
              className="curl-block-code-input curl-block-setup-input"
              value={curlInput}
              rows={6}
              spellCheck={false}
              autoFocus
              placeholder={CURL_PLACEHOLDER}
              aria-label="Curl command"
              onChange={(event) => {
                setCurlInput(event.target.value)
                if (setupError) setSetupError(null)
              }}
              onMouseDown={stopPropagation}
              onKeyDown={(event) => {
                stopPropagation(event)
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  handleLoadCurl()
                }
              }}
            />
          </code>
        </pre>
        {setupError ? (
          <p className="curl-block-setup-error" role="alert">
            {setupError}
          </p>
        ) : null}
        <p className="curl-block-setup-actions">
          <button
            type="button"
            className="curl-block-run"
            onClick={handleLoadCurl}
            onMouseDown={stopPropagation}
          >
            Load request
          </button>
          <button
            type="button"
            className="curl-block-inline-action"
            onClick={() => updateAttributes({ configured: true })}
            onMouseDown={stopPropagation}
          >
            Set up manually
          </button>
          <span className="curl-block-setup-hint">⌘/Ctrl + Enter to load</span>
        </p>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      as="div"
      className={`curl-block ${selected ? 'is-selected' : ''}`}
      contentEditable={false}
      data-curl-block=""
      data-configured="true"
    >
      <p className="curl-block-request">
        <select
          className="curl-block-method"
          data-method={attrs.method}
          value={attrs.method}
          aria-label="HTTP method"
          style={{ width: `${attrs.method.length}ch` }}
          onChange={(event) =>
            updateAttributes({ method: event.target.value as HttpMethod })
          }
          onMouseDown={stopPropagation}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <input
          className="curl-block-url"
          type="url"
          value={urlDraft}
          placeholder="https://api.example.com"
          aria-label="Request URL"
          spellCheck={false}
          onChange={(event) => setUrlDraft(event.target.value)}
          onBlur={syncUrlOnBlur}
          onKeyDown={(event) => {
            stopPropagation(event)
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSend()
            }
          }}
          onMouseDown={stopPropagation}
        />
        <button
          type="button"
          className="curl-block-run"
          disabled={loading}
          onClick={() => void handleSend()}
          onMouseDown={stopPropagation}
        >
          {loading ? 'Running…' : 'Run'}
        </button>
      </p>

      {showHeaders ? (
        <section className="curl-block-section">
          <p className="curl-block-section-label">Request headers</p>
          <pre className="curl-block-code">
            <code>
              <textarea
                className="curl-block-code-input"
                value={headersDraft}
                rows={headersRows}
                spellCheck={false}
                aria-label="Request headers JSON"
                onChange={(event) => setHeadersDraft(event.target.value)}
                onBlur={formatHeadersOnBlur}
                onMouseDown={stopPropagation}
                onKeyDown={stopPropagation}
              />
            </code>
          </pre>
        </section>
      ) : (
        <p className="curl-block-hint">
          <button
            type="button"
            className="curl-block-inline-action"
            onClick={() => updateAttributes({ headers: '{\n  \n}' })}
            onMouseDown={stopPropagation}
          >
            Add headers
          </button>
        </p>
      )}

      {showBody ? (
        <section className="curl-block-section">
          <p className="curl-block-section-label">Request body</p>
          <pre className="curl-block-code">
            <code>
              <textarea
                className="curl-block-code-input"
                value={bodyDraft}
                rows={bodyRows}
                spellCheck={false}
                placeholder={'{\n  "key": "value"\n}'}
                aria-label="Request body JSON"
                onChange={(event) => setBodyDraft(event.target.value)}
                onBlur={formatBodyOnBlur}
                onMouseDown={stopPropagation}
                onKeyDown={stopPropagation}
              />
            </code>
          </pre>
        </section>
      ) : null}

      {error || statusLine || responseBody ? (
        <section className="curl-block-section" aria-live="polite">
          <p className="curl-block-section-label">
            {error ? 'Response error' : `Response${statusLine ? ` · ${statusLine}` : ''}`}
          </p>
          {error ? (
            <pre className="curl-block-code curl-block-code-error">
              <code>{error}</code>
            </pre>
          ) : responseBody ? (
            <pre className="curl-block-code curl-block-code-readonly">
              <code>{responseBody}</code>
            </pre>
          ) : null}
        </section>
      ) : null}
    </NodeViewWrapper>
  )
}
