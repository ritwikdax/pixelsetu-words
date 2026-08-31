export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export function clampMonth(value: number): number {
  if (!Number.isInteger(value) || value < 1) return 1
  if (value > 12) return 12
  return value
}

export function clampYear(value: number): number {
  if (!Number.isInteger(value) || value < 1) return 1
  if (value > 9999) return 9999
  return value
}

export function stepMonth(month: number, delta: number): number {
  return ((clampMonth(month) - 1 + delta + 12000) % 12) + 1
}

export function stepYear(year: number, delta: number): number {
  return clampYear(year + delta)
}

export function yearOptions(selectedYear: number): number[] {
  const now = new Date().getFullYear()
  const start = Math.min(now - 40, selectedYear - 20)
  const end = Math.max(now + 20, selectedYear + 20)
  const years: number[] = []
  for (let year = start; year <= end; year += 1) {
    years.push(year)
  }
  return years
}

export interface CalendarCell {
  day: number
  inMonth: boolean
  isToday: boolean
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrev = new Date(year, month - 1, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDate = today.getDate()

  const cells: CalendarCell[] = []

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    cells.push({ day: daysInPrev - i, inMonth: false, isToday: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      inMonth: true,
      isToday: isCurrentMonth && day === todayDate,
    })
  }

  const remainder = cells.length % 7
  const trailing = remainder === 0 ? 0 : 7 - remainder
  for (let day = 1; day <= trailing; day += 1) {
    cells.push({ day, inMonth: false, isToday: false })
  }

  return cells
}

export function monthFromQuery(query: string, current: number): number | null {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  const matches = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label: label.toLowerCase(),
  })).filter((entry) => entry.label.startsWith(normalized))

  if (matches.length === 0) return null
  const afterCurrent = matches.find((entry) => entry.month > current)
  return (afterCurrent ?? matches[0]).month
}
