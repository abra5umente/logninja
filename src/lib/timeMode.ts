import { LogEntry } from './types'

// How times are shown: in the viewer's own time zone ('local'), or on the clock the log was written
// in ('log'). They only differ for lines whose timestamp names a zone (Z, +10:00, +1000); a line
// without one is read as local time, which is also how it was written.
export type TimeMode = 'local' | 'log'

export const TIME_MODE_KEY = 'logninja.timeMode'

export function getTimeMode(): TimeMode {
  try {
    if (localStorage.getItem(TIME_MODE_KEY) === 'log') return 'log'
  } catch { }
  return 'local'
}

export function saveTimeMode(mode: TimeMode) {
  try {
    localStorage.setItem(TIME_MODE_KEY, mode)
  } catch { }
}

const reZone = /(?:Z|([+-])(\d{2}):?(\d{2}))$/

/** Minutes east of UTC that a timestamp was written in, or null when it names no zone */
export function zoneOffsetOf(timeStr: string): number | null {
  const m = reZone.exec(timeStr.trim())
  if (!m) return null
  if (!m[1]) return 0
  const minutes = Number(m[2]) * 60 + Number(m[3])
  return m[1] === '-' ? -minutes : minutes
}

// A Date whose local clock reads what a clock offsetMin east of UTC read at instant t
function onLogClock(t: number, offsetMin: number): number {
  // getTimezoneOffset is minutes west of UTC; checked again at the result for daylight saving
  const first = t + (offsetMin + new Date(t).getTimezoneOffset()) * 60_000
  return t + (offsetMin + new Date(first).getTimezoneOffset()) * 60_000
}

/**
 * The entries with each zoned time moved so that the local clock reads what the log wrote, for
 * 'log' mode. Everything downstream (table, timeline, time range, summary, exports) then shows the
 * log's own clock without knowing about the mode. Order and entry keys don't change; the original
 * array comes back when no time moved.
 */
export function inLogTime(entries: LogEntry[]): LogEntry[] {
  let changed = false
  const out = entries.map(e => {
    if (!e.time) return e
    const offset = zoneOffsetOf(e.timeStr)
    if (offset === null) return e
    const t = e.time.getTime()
    const shown = onLogClock(t, offset)
    if (shown === t) return e
    changed = true
    return { ...e, time: new Date(shown) }
  })
  return changed ? out : entries
}
