// All "today" math uses the church's home time zone so a 10 PM check-in in Indianapolis
// isn't counted as tomorrow.
export const CHURCH_TZ = 'America/Indiana/Indianapolis'

export function todayISO(tz = CHURCH_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO + 'T12:00:00Z') - Date.parse(fromISO + 'T12:00:00Z')) / 86_400_000)
}

export function fmtShort(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: iso.length === 10 ? 'UTC' : CHURCH_TZ,
  })
}

export function fmtLong(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: CHURCH_TZ })
}

/** "Today", "Tomorrow", weekday within a week, else "Nov 14". */
export function dueLabel(iso: string, today = todayISO()) {
  const diff = daysBetween(today, iso)
  if (diff < 0) return `${-diff}d overdue`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 7) return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return fmtShort(iso)
}

export function hoursSince(ts: string | null | undefined) {
  if (!ts) return null
  return (Date.now() - Date.parse(ts)) / 3_600_000
}

/** The next occurrence of a month/day on or after today, plus how many years it marks. */
export function nextAnniversary(dateISO: string, today = todayISO()) {
  const [y, m, d] = dateISO.split('-').map(Number)
  const ty = Number(today.slice(0, 4))
  let next = `${ty}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (next < today) next = `${ty + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { date: next, years: Number(next.slice(0, 4)) - y }
}
