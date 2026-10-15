import { FiltersState, LogEntry, LogLevel } from './types'

function csvEscape(value: string): string {
  const v = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

// Rows per CSV piece. A million long rows add up to more text than a browser allows in one string
// (about 512 MB in Chrome), so a download is built from pieces instead.
const CSV_CHUNK_ROWS = 10000

/** The CSV in pieces that join (with no separator) into the whole file */
export function rowsToCSVChunks(rows: LogEntry[], bookmarked: LogEntry[] = []): string[] {
  const chunks: string[] = []
  let lines: string[] = []
  const flush = () => {
    if (lines.length === 0) return
    chunks.push((chunks.length > 0 ? '\n' : '') + lines.join('\n'))
    lines = []
  }
  const add = (line: string) => {
    lines.push(line)
    if (lines.length >= CSV_CHUNK_ROWS) flush()
  }
  const header = ['Time', 'Level', 'Message'].join(',')
  const row = (r: LogEntry) => [r.time ? r.time.toISOString() : r.timeStr, r.level, r.message].map(c => csvEscape(c ?? '')).join(',')
  add(header)
  for (const r of rows) add(row(r))
  if (bookmarked.length > 0) {
    add('')
    add('Bookmarked Lines')
    add(header)
    for (const r of bookmarked) add(row(r))
  }
  flush()
  return chunks
}

/** The CSV as one string. Throws a RangeError when it is too long for one string; csvBlob never does. */
export function rowsToCSV(rows: LogEntry[], bookmarked: LogEntry[] = []): string {
  return rowsToCSVChunks(rows, bookmarked).join('')
}

/** The CSV as a file to download, built from pieces so any number of rows fits */
export function csvBlob(rows: LogEntry[], bookmarked: LogEntry[] = []): Blob {
  return new Blob(rowsToCSVChunks(rows, bookmarked), { type: 'text/csv;charset=utf-8' })
}

export function buildMarkdownSummary(rows: LogEntry[], filters: FiltersState, bookmarked: LogEntry[] = []) {
  const total = rows.length
  const levelOrder: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']
  const levelCounts: Record<LogLevel, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0, UNKNOWN: 0 }
  const messageCounts = new Map<string, number>()

  for (const r of rows) {
    levelCounts[r.level] = (levelCounts[r.level] ?? 0) + 1
    if (r.message) messageCounts.set(r.message, (messageCounts.get(r.message) ?? 0) + 1)
  }

  const topMessages = Array.from(messageCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const activeLevels = filters.selectedLevels && filters.selectedLevels.length > 0
    ? filters.selectedLevels.join(', ')
    : filters.selectedLevel || 'all'
  const query = filters.query ? (filters.useRegex ? `regex: ${filters.query}` : `text: ${filters.query}`) : 'none'
  const timeRange = filters.timeRange ? `${filters.timeRange.start.toISOString()} → ${filters.timeRange.end.toISOString()}` : 'none'

  const lines: string[] = []
  lines.push(`# Log Summary`)
  lines.push('')
  lines.push(`- Total rows: ${total}`)
  lines.push(`- Active levels: ${activeLevels || 'none'}`)
  lines.push(`- Search: ${query}`)
  lines.push(`- Time filter: ${timeRange}`)
  lines.push('')
  lines.push(`## Counts by Level`)
  for (const lvl of levelOrder) {
    const c = levelCounts[lvl] ?? 0
    if (c > 0) lines.push(`- ${lvl}: ${c}`)
  }
  if (levelOrder.every(l => (levelCounts[l] ?? 0) === 0)) lines.push('- none')
  lines.push('')
  lines.push(`## Top 10 Messages`)
  if (topMessages.length === 0) {
    lines.push('- none')
  } else {
    for (const [msg, count] of topMessages) lines.push(`- ${count} × ${sanitizeMd(msg)}`)
  }
  lines.push('')
  if (bookmarked.length > 0) {
    lines.push('## Bookmarked Lines')
    for (const r of bookmarked) {
      const t = r.time ? r.time.toISOString() : r.timeStr
      lines.push(`- ${t} • ${r.level} • ${sanitizeMd(r.message)}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function sanitizeMd(s: string) {
  // Avoid breaking Markdown with backticks and pipes
  return s.replace(/`/g, '\\`').replace(/\|/g, '\\|')
}
