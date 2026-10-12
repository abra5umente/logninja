export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN'

export interface FileInfo {
  id: string
  name: string
  color: string
  entryCount: number
}

export interface LogEntry {
  /** Position in the merged, sorted list. Changes whenever a file is added or removed. */
  index: number
  /** 1-based line in its own file where this entry starts. Stays put, unlike index. */
  line: number
  time: Date | null
  timeStr: string
  level: LogLevel
  source: string
  message: string
  raw: string
  fileId?: string  // Optional for backward compatibility
  fileName?: string  // Optional for backward compatibility
}

export interface FiltersState {
  selectedLevel: Exclude<LogLevel, 'UNKNOWN'> | null  // Deprecated: kept for backward compatibility
  selectedLevels: LogLevel[] | null
  selectedFiles: string[] | null
  query: string
  useRegex: boolean
  timeRange?: { start: Date; end: Date } | null
  highlightOnly: boolean
  showBookmarksOnly: boolean
  bookmarkContext: number
  searchMode: 'filter' | 'find'  // New: find = jump to matches, filter = show only matches
  currentMatchIndex: number  // New: tracks which match is currently selected in find mode
}

export interface ChunkBin {
  start: Date
  end: Date
  count: number
  levelCounts: Partial<Record<LogLevel, number>>
}


/** Stable id for an entry: its file plus the line it starts on. Survives files being added or removed. */
export function entryKey(e: Pick<LogEntry, 'fileId' | 'line'>): string {
  return `${e.fileId ?? ''}:${e.line}`
}
