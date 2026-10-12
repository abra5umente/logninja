import { LogEntry, LogLevel } from './types'

export interface TimeRange {
  start: Date
  end: Date
}

export interface TimelineBin {
  start: Date
  end: Date
  count: number
  levelCounts: Partial<Record<LogLevel, number>>
  matches: number
}

const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
export const DAY = 24 * HOUR

// Bar widths the timeline can use, smallest first. pickBinMs takes the first one that keeps
// the view under maxBins bars; anything coarser than 7 days becomes a whole number of days.
export const BIN_STEPS = [
  SEC, 2 * SEC, 5 * SEC, 10 * SEC, 15 * SEC, 30 * SEC,
  MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY,
]
export const MIN_BIN_MS = BIN_STEPS[0]

export function pickBinMs(spanMs: number, maxBins = 72): number {
  for (const step of BIN_STEPS) {
    if (spanMs / step <= maxBins) return step
  }
  return Math.ceil(spanMs / maxBins / DAY) * DAY
}

// Earliest and latest timestamp, with an exclusive end. Uses a loop rather than
// Math.min(...arr), which overflows the stack on large inputs.
export function timeExtent(entries: LogEntry[]): TimeRange | null {
  let min = Infinity
  let max = -Infinity
  for (const e of entries) {
    if (!e.time) continue
    const t = e.time.getTime()
    if (t < min) min = t
    if (t > max) max = t
  }
  if (min === Infinity) return null
  return { start: new Date(min), end: new Date(max + 1) }
}

// Bin edges line up with the local clock: day bins start at local midnight and hour bins on
// the local hour, so a viewer east or west of UTC doesn't see days starting mid-morning.
function floorLocal(t: number, binMs: number): number {
  if (binMs % DAY === 0) {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const offset = -new Date(t).getTimezoneOffset() * MIN
  return Math.floor((t + offset) / binMs) * binMs - offset
}

function nextEdge(t: number, binMs: number): number {
  if (binMs % DAY === 0) {
    // step by calendar days so daylight-saving changes don't drift the edges off midnight
    const d = new Date(t)
    d.setDate(d.getDate() + binMs / DAY)
    return d.getTime()
  }
  return t + binMs
}

export function buildBins(
  entries: LogEntry[],
  range: TimeRange,
  binMs: number,
  isMatch?: ((e: LogEntry) => boolean) | null,
): TimelineBin[] {
  const edges: number[] = []
  const endMs = range.end.getTime()
  let cur = floorLocal(range.start.getTime(), binMs)
  edges.push(cur)
  do {
    cur = nextEdge(cur, binMs)
    edges.push(cur)
  } while (cur < endMs)

  const bins: TimelineBin[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    bins.push({ start: new Date(edges[i]), end: new Date(edges[i + 1]), count: 0, levelCounts: {}, matches: 0 })
  }

  const first = edges[0]
  const last = edges[edges.length - 1]
  for (const e of entries) {
    if (!e.time) continue
    const t = e.time.getTime()
    if (t < first || t >= last) continue
    // binary search for the bin whose start is the last edge <= t
    let lo = 0
    let hi = bins.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (edges[mid] <= t) lo = mid
      else hi = mid - 1
    }
    const bin = bins[lo]
    bin.count += 1
    bin.levelCounts[e.level] = (bin.levelCounts[e.level] ?? 0) + 1
    if (isMatch && isMatch(e)) bin.matches += 1
  }
  return bins
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function clockLabel(d: Date, withSeconds: boolean): string {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${hm}:${pad(d.getSeconds())}` : hm
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Axis label for a bar starting at d. withDate prefixes the date, for the first label and
// wherever the day changes.
export function formatTick(d: Date, binMs: number, withDate: boolean): string {
  if (binMs >= DAY) return dateLabel(d)
  const clock = clockLabel(d, binMs < MIN)
  return withDate ? `${dateLabel(d)} ${clock}` : clock
}

// A readable span such as "Oct 12 14:00 – 15:00". The end is exclusive, so day-sized ranges
// show their last whole day instead ("Oct 12 – Oct 14").
export function formatRange(range: TimeRange, binMs: number): string {
  const { start, end } = range
  if (binMs >= DAY) {
    const lastDay = new Date(end.getTime() - 1)
    return sameLocalDay(start, lastDay) ? dateLabel(start) : `${dateLabel(start)} – ${dateLabel(lastDay)}`
  }
  const withSeconds = binMs < MIN || start.getSeconds() !== 0 || end.getSeconds() !== 0
  const from = `${dateLabel(start)} ${clockLabel(start, withSeconds)}`
  const endIsMidnight = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0
  if (sameLocalDay(start, end) || (endIsMidnight && end.getTime() - start.getTime() <= DAY)) {
    return `${from} – ${clockLabel(end, withSeconds)}`
  }
  return `${from} – ${dateLabel(end)} ${clockLabel(end, withSeconds)}`
}

export function formatStep(binMs: number): string {
  if (binMs % DAY === 0) return binMs === DAY ? '1 day' : `${binMs / DAY} days`
  if (binMs % HOUR === 0) return binMs === HOUR ? '1 hour' : `${binMs / HOUR} hours`
  if (binMs % MIN === 0) return `${binMs / MIN} min`
  return `${binMs / SEC} sec`
}
