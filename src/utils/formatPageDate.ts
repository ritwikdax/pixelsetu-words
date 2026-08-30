export function formatPageCreatedAt(timestamp: number): { date: string; time: string; iso: string } {
  const created = new Date(timestamp)
  return {
    date: created.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    time: created.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
    iso: created.toISOString(),
  }
}
