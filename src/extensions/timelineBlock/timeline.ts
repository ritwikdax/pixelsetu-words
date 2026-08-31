export interface TimelineItem {
  id: string
  time: string
  title: string
  subtext: string
}

function newTimelineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createTimelineItem(partial: Partial<TimelineItem> = {}): TimelineItem {
  return {
    id: partial.id?.trim() || newTimelineId(),
    time: partial.time ?? '',
    title: partial.title ?? '',
    subtext: partial.subtext ?? '',
  }
}

export function defaultTimelineItems(): TimelineItem[] {
  return [
    createTimelineItem({ time: '09:00' }),
    createTimelineItem({ time: '12:00' }),
    createTimelineItem({ time: '17:00' }),
  ]
}

export function parseTimelineItems(value: unknown): TimelineItem[] {
  let raw: unknown = value
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return defaultTimelineItems()
    try {
      raw = JSON.parse(trimmed)
    } catch {
      return defaultTimelineItems()
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) return defaultTimelineItems()
  return raw.map((item) => {
    if (!item || typeof item !== 'object') return createTimelineItem()
    const rec = item as Record<string, unknown>
    return createTimelineItem({
      id: typeof rec.id === 'string' ? rec.id : undefined,
      time: typeof rec.time === 'string' ? rec.time : '',
      title: typeof rec.title === 'string' ? rec.title : '',
      subtext: typeof rec.subtext === 'string' ? rec.subtext : '',
    })
  })
}
