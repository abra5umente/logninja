export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN'

export interface FileInfo {
  id: string
  name: string
  color: string
  entryCount: number
}

export interface LogEntry {
  index: number
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
  selectedLevel: Exclude<LogLevel, 'UNKNOWN'> | null
  query: string
  useRegex: boolean
  timeRange?: { start: Date; end: Date } | null
  highlightOnly: boolean
}

export interface ChunkBin {
  start: Date
  end: Date
  count: number
  levelCounts: Partial<Record<LogLevel, number>>
}

