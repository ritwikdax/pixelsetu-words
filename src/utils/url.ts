/** Turn user text into a usable href when it looks like a URL. */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`

  if (/^[a-z0-9][-a-z0-9]*(\.[a-z0-9][-a-z0-9]*)+/i.test(trimmed)) {
    return `https://${trimmed}`
  }

  return null
}
