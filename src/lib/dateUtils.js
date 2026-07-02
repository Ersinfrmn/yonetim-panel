import { format, parseISO } from 'date-fns'

// Shared day-boundary helpers. All daily stats (pomodoro, habits, tasks,
// journal) use the user's local timezone (Europe/Istanbul in practice) —
// date-fns `format` renders in the browser's local timezone.

export const fmtDay = d => format(d, 'yyyy-MM-dd')

export const todayStr = () => fmtDay(new Date())

// Local calendar day ('yyyy-MM-dd') of a timestamptz value.
export const localDayOf = ts => (ts ? fmtDay(parseISO(ts)) : null)

// Start of a local calendar day as an ISO/UTC string, safe to use in
// Supabase filters against timestamptz columns. A bare 'yyyy-MM-ddT00:00:00'
// string would be interpreted as UTC by Postgres and shift the boundary.
export function dayStartISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

export const startOfTodayISO = () => dayStartISO(new Date())

export function endOfTodayISO() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).toISOString()
}

// A pomodoro session counts as completed under both the old (`completed`)
// and new (`was_completed`) schema flags.
export const isSessionCompleted = s => s.was_completed === true || s.completed === true

// The local calendar day a session belongs to (completion time, falling back
// to start time).
export const sessionDay = s => localDayOf(s.completed_at || s.started_at)
