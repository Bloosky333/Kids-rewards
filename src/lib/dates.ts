// Dates are handled as "YYYY-MM-DD" strings (the server decides what "today" is).

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** ISO weekday 1..7 of a "YYYY-MM-DD" date. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return wd === 0 ? 7 : wd
}

export const mondayOf = (iso: string) => addDays(iso, 1 - isoWeekday(iso))

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  const [y, m, d] = iso.split('-').map(Number)
  const s = new Intl.DateTimeFormat('fr-BE', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Local wall-clock minutes since midnight (used only for highlighting the current slot). */
export const nowMinutes = () => {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

export const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)
