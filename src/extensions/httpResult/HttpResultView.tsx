import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  formatScalar,
  humanizeKey,
  HTTP_RESULT_MAX_DEPTH,
  HTTP_RESULT_MAX_ROWS,
  isObjectRecordArray,
  isPlainObject,
  parseHttpResultBody,
} from '../../utils/httpResult'

interface HttpResultAttrs {
  contentType: string
  body: string
}

function Scalar({ value }: { value: unknown }) {
  const formatted = formatScalar(value)
  if (formatted.kind === 'empty') {
    return <span className="http-result-empty">{formatted.text}</span>
  }
  if (formatted.kind === 'url' && formatted.href) {
    return (
      <a href={formatted.href} target="_blank" rel="noopener noreferrer">
        {formatted.text}
      </a>
    )
  }
  return <span>{formatted.text}</span>
}

function HttpValue({ value, depth }: { value: unknown; depth: number }) {
  if (depth > HTTP_RESULT_MAX_DEPTH) {
    return <span className="http-result-empty">…</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="http-result-empty">None</span>
    if (isObjectRecordArray(value)) {
      return <HttpTable rows={value} depth={depth} />
    }
    return (
      <ul className="http-result-list">
        {value.slice(0, HTTP_RESULT_MAX_ROWS).map((item, index) => (
          <li key={index}>
            <HttpValue value={item} depth={depth + 1} />
          </li>
        ))}
        {value.length > HTTP_RESULT_MAX_ROWS ? (
          <li className="http-result-more">+ {value.length - HTTP_RESULT_MAX_ROWS} more</li>
        ) : null}
      </ul>
    )
  }

  if (isPlainObject(value)) {
    return <HttpCard data={value} depth={depth} />
  }

  return <Scalar value={value} />
}

function HttpCard({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(data)
  if (entries.length === 0) {
    return <p className="http-result-empty">Empty</p>
  }

  return (
    <dl className={`http-result-card ${depth > 0 ? 'is-nested' : ''}`}>
      {entries.map(([key, value]) => (
        <div key={key} className="http-result-row">
          <dt>{humanizeKey(key)}</dt>
          <dd>
            <HttpValue value={value} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function HttpTable({
  rows,
  depth,
}: {
  rows: Record<string, unknown>[]
  depth: number
}) {
  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }
  const visible = rows.slice(0, HTTP_RESULT_MAX_ROWS)

  return (
    <div className="http-result-table-wrap">
      <table className="http-result-table">
        <thead>
          <tr>
            {columns.map((key) => (
              <th key={key}>{humanizeKey(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              {columns.map((key) => {
                const cell = row[key]
                const nested = isPlainObject(cell) || Array.isArray(cell)
                return (
                  <td key={key}>
                    {nested ? (
                      <HttpValue value={cell} depth={depth + 1} />
                    ) : (
                      <Scalar value={cell} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > HTTP_RESULT_MAX_ROWS ? (
        <p className="http-result-more">
          Showing {HTTP_RESULT_MAX_ROWS} of {rows.length}
        </p>
      ) : null}
    </div>
  )
}

export function HttpResultView({ node }: NodeViewProps) {
  const attrs = node.attrs as HttpResultAttrs
  const parsed = parseHttpResultBody(attrs.body, attrs.contentType)

  return (
    <NodeViewWrapper as="div" className="http-result" contentEditable={false} data-http-result="">
      <HttpValue value={parsed} depth={0} />
    </NodeViewWrapper>
  )
}
