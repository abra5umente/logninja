import { FiltersState, LogEntry, LogLevel } from './types'

function csvEscape(value: string): string {
  const v = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"'
  }
  return v
}

export function rowsToCSV(rows: LogEntry[], bookmarked: LogEntry[] = []): string {
  const header = ['Time', 'Level', 'Message']
  const lines = [header.join(',')]
  for (const r of rows) {
    const cols = [r.time ? r.time.toISOString() : r.timeStr, r.level, r.message]
    lines.push(cols.map(c => csvEscape(c ?? '')).join(','))
  }
  if (bookmarked.length > 0) {
    lines.push('')
    lines.push('Bookmarked Lines')
    lines.push(header.join(','))
    for (const r of bookmarked) {
      const cols = [r.time ? r.time.toISOString() : r.timeStr, r.level, r.message]
      lines.push(cols.map(c => csvEscape(c ?? '')).join(','))
    }
  }
  return lines.join('\n')
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

  const activeLevels = Array.from(filters.levels).join(', ')
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
