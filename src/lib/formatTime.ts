import { LogEntry } from './types'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

// The table shows times in the viewer's local zone, like the timeline does, as
// "2026-01-05 14:00:00" (with milliseconds when the log line had a fraction).
// Lines without a zone are parsed as local time, so this reads as written.
export function formatEntryTime(entry: Pick<LogEntry, 'time' | 'timeStr'>): string {
  const d = entry.time
  if (!d) return entry.timeStr || ''
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return /\d:\d{2}:\d{2}[.,:]\d/.test(entry.timeStr) ? `${base}.${pad(d.getMilliseconds(), 3)}` : base
}
