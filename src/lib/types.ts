export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'UNKNOWN'

export interface LogEntry {
  index: number
  time: Date | null
  timeStr: string
  level: LogLevel
  source: string
  message: string
  raw: string
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

