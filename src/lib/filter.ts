import { FiltersState, LogEntry, entryKey } from './types'

// The file, level and time filters. Search is handled separately because it
// depends on the search mode.
export function passesBaseFilters(e: LogEntry, f: FiltersState): boolean {
  if (f.selectedFiles && f.selectedFiles.length > 0 && e.fileId) {
    if (!f.selectedFiles.includes(e.fileId)) return false
  }
  // Use selectedLevels, or fall back to the deprecated selectedLevel
  if (f.selectedLevels && f.selectedLevels.length > 0) {
    if (!f.selectedLevels.includes(e.level)) return false
  } else if (f.selectedLevel && e.level !== f.selectedLevel) {
    return false
  }
  if (f.timeRange) {
    // Entries without a timestamp are dropped while a time range is active
    if (!e.time) return false
    const t = e.time.getTime()
    if (t < f.timeRange.start.getTime() || t >= f.timeRange.end.getTime()) return false
  }
  return true
}

// Bookmarked rows plus `context` rows either side of each, in order.
export function withBookmarkContext(rows: LogEntry[], bookmarked: Set<string>, context: number): LogEntry[] {
  if (bookmarked.size === 0) return []
  const keep = new Set<number>()
  rows.forEach((e, pos) => {
    if (!bookmarked.has(entryKey(e))) return
    const from = Math.max(0, pos - context)
    const to = Math.min(rows.length - 1, pos + context)
    for (let i = from; i <= to; i++) keep.add(i)
  })
  return rows.filter((_, pos) => keep.has(pos))
}
