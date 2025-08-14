import { ChunkBin, LogEntry, LogLevel } from './types'

export function floorToBin(date: Date, minutes: number): Date {
  const ms = date.getTime()
  const binMs = minutes * 60 * 1000
  return new Date(Math.floor(ms / binMs) * binMs)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

// Millisecond-based versions for sub-minute chunking
export function floorToBinMs(date: Date, binMs: number): Date {
  const ms = date.getTime()
  return new Date(Math.floor(ms / binMs) * binMs)
}

export function addMs(date: Date, binMs: number): Date {
  return new Date(date.getTime() + binMs)
}

export function groupByBinsMs(entries: LogEntry[], binMs: number): ChunkBin[] {
  const withTime: LogEntry[] = []
  let minTime = Number.POSITIVE_INFINITY
  let maxTime = Number.NEGATIVE_INFINITY
  for (const e of entries) {
    if (!e.time) continue
    const t = e.time.getTime()
    withTime.push(e)
    if (t < minTime) minTime = t
    if (t > maxTime) maxTime = t
  }
  if (withTime.length === 0) return []

  const min = new Date(minTime)
  const max = new Date(maxTime)
  const start = floorToBinMs(min, binMs)
  const end = addMs(floorToBinMs(max, binMs), binMs)

  const bins: ChunkBin[] = []
  for (let cur = new Date(start); cur < end; cur = addMs(cur, binMs)) {
    bins.push({ start: new Date(cur), end: addMs(cur, binMs), count: 0, levelCounts: {} })
  }
  const startMs = start.getTime()
  for (const e of withTime) {
    const idx = Math.floor((e.time!.getTime() - startMs) / binMs)
    const bin = bins[idx]
    if (!bin) continue
    bin.count += 1
    const lvl: LogLevel = e.level
    bin.levelCounts[lvl] = (bin.levelCounts[lvl] ?? 0) + 1
  }
  return bins
}

export function groupByBins(entries: LogEntry[], minutes: number): ChunkBin[] {
  // Filter once and compute min/max without spreading huge arrays
  const withTime: LogEntry[] = []
  let minTime = Number.POSITIVE_INFINITY
  let maxTime = Number.NEGATIVE_INFINITY
  for (const e of entries) {
    if (!e.time) continue
    const t = e.time.getTime()
    withTime.push(e)
    if (t < minTime) minTime = t
    if (t > maxTime) maxTime = t
  }
  if (withTime.length === 0) return []

  const min = new Date(minTime)
  const max = new Date(maxTime)
  const start = floorToBin(min, minutes)
  const end = addMinutes(floorToBin(max, minutes), minutes)

  const bins: ChunkBin[] = []
  for (let cur = new Date(start); cur < end; cur = addMinutes(cur, minutes)) {
    bins.push({ start: new Date(cur), end: addMinutes(cur, minutes), count: 0, levelCounts: {} })
  }
  const startMs = start.getTime()
  const binMs = minutes * 60 * 1000
  for (const e of withTime) {
    const idx = Math.floor((e.time!.getTime() - startMs) / binMs)
    const bin = bins[idx]
    if (!bin) continue
    bin.count += 1
    const lvl: LogLevel = e.level
    bin.levelCounts[lvl] = (bin.levelCounts[lvl] ?? 0) + 1
  }
  return bins
}
