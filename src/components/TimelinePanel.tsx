import React, { useMemo, useState } from 'react'
import { LogEntry, ChunkBin } from '../lib/types'
import { groupByBinsMs } from '../lib/time'

interface Props {
  entries: LogEntry[]
  binMs: number
  setBinMs: (ms: number) => void
  onSelectRange: (range: { start: Date; end: Date } | null) => void
  activeRange?: { start: Date; end: Date } | null
  virtualTableRows?: number
}

type TimelineLevel = 'day' | 'hour' | '15min' | 'minute' | 'second'

interface DrillState {
  level: TimelineLevel
  parentRange: { start: Date; end: Date } | null
}

const LEVEL_CONFIG = {
  day: { ms: 86400000, label: 'Day', next: 'hour' as TimelineLevel, plural: 'Days' },
  hour: { ms: 3600000, label: 'Hour', next: '15min' as TimelineLevel, plural: 'Hours' },
  '15min': { ms: 900000, label: '15 Min', next: 'minute' as TimelineLevel, plural: '15 Min' },
  minute: { ms: 60000, label: 'Minute', next: 'second' as TimelineLevel, plural: 'Minutes' },
  second: { ms: 1000, label: 'Second', next: null, plural: 'Seconds' }
}

export default function TimelinePanel({ entries, binMs, setBinMs, onSelectRange, activeRange }: Props) {
  const [drillState, setDrillState] = useState<DrillState>({ level: 'day', parentRange: null })
  const [drillHistory, setDrillHistory] = useState<DrillState[]>([])

  // Calculate time span of all entries
  const timeSpan = useMemo(() => {
    if (entries.length === 0) return 0
    const times = entries.map(e => e.time).filter(Boolean) as Date[]
    if (times.length === 0) return 0

    // Use reduce instead of spread operator to avoid stack overflow with large arrays
    let min = Infinity
    let max = -Infinity
    for (const time of times) {
      const t = time.getTime()
      if (t < min) min = t
      if (t > max) max = t
    }

    return max - min
  }, [entries])

  // Determine appropriate level based on time span and drill state
  const currentLevel: TimelineLevel = useMemo(() => {
    if (drillState.parentRange) {
      return drillState.level
    }

    // Auto-select level based on span
    const HOUR = 3600000
    const DAY = 86400000

    if (timeSpan <= DAY) return 'hour'
    return 'day'
  }, [timeSpan, drillState])

  // Filter entries to current drill range
  const filteredEntries = useMemo(() => {
    if (!drillState.parentRange) return entries

    return entries.filter(e => {
      if (!e.time) return false
      const t = e.time.getTime()
      return t >= drillState.parentRange!.start.getTime() && t < drillState.parentRange!.end.getTime()
    })
  }, [entries, drillState.parentRange])

  // Generate bins for current level
  const bins = useMemo(() => {
    return groupByBinsMs(filteredEntries, LEVEL_CONFIG[currentLevel].ms)
  }, [filteredEntries, currentLevel])

  const maxCount = useMemo(() => bins.reduce((m, b) => Math.max(m, b.count), 0), [bins])
  const [selectedBinIndex, setSelectedBinIndex] = useState<number | null>(null)

  // Calculate aggregate stats for current filter
  const filterStats = useMemo(() => {
    if (!activeRange) return null

    const totalCount = filteredEntries.length
    const levelCounts: Record<string, number> = {}

    filteredEntries.forEach(entry => {
      const level = entry.level || 'UNKNOWN'
      levelCounts[level] = (levelCounts[level] || 0) + 1
    })

    return { totalCount, levelCounts }
  }, [filteredEntries, activeRange])

  const formatRange = (b: ChunkBin) => {
    const start = b.start

    if (currentLevel === 'day') {
      return `${start.toLocaleDateString()}`
    } else if (currentLevel === 'hour') {
      return `${start.getHours()}:00`
    } else if (currentLevel === '15min') {
      return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`
    } else if (currentLevel === 'minute') {
      return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`
    } else {
      return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}:${String(start.getSeconds()).padStart(2, '0')}`
    }
  }

  const handleBinClick = (bin: ChunkBin, idx: number) => {
    const nextLevel = LEVEL_CONFIG[currentLevel].next

    // Always filter the log view to the selected time range
    onSelectRange({ start: bin.start, end: bin.end })
    setSelectedBinIndex(idx)

    if (!nextLevel) {
      // At deepest level, stay here with filter applied
      return
    }

    // Save current state to history before drilling down
    setDrillHistory(prev => [...prev, drillState])

    // Drill down to next level while keeping the filter
    setDrillState({
      level: nextLevel,
      parentRange: { start: bin.start, end: bin.end }
    })
  }

  const handleDrillUp = () => {
    if (drillHistory.length === 0) {
      // No history, reset to initial state
      setDrillState({ level: 'day', parentRange: null })
      setSelectedBinIndex(null)
      onSelectRange(null)
      return
    }

    // Pop the last state from history
    const previousState = drillHistory[drillHistory.length - 1]
    setDrillHistory(prev => prev.slice(0, -1))
    setDrillState(previousState)
    setSelectedBinIndex(null)

    // Update filter to match the previous state's range
    if (previousState.parentRange) {
      onSelectRange(previousState.parentRange)
    } else {
      onSelectRange(null)
    }
  }

  return (
    <div className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md flex-shrink-0">
      <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 px-3 py-1.5 text-xs">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold">Timeline</div>
          {activeRange && (
            <button className="text-[11px] text-[var(--accent)] hover:underline" onClick={() => onSelectRange(null)}>Clear Filter</button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-gray-600 dark:text-gray-400">
            Viewing: <span className="font-semibold text-gray-800 dark:text-gray-200">{LEVEL_CONFIG[currentLevel].label}</span>
            {bins.length > 0 && <span className="ml-1">({bins.length} {currentLevel === 'day' ? 'days' : currentLevel === 'hour' ? 'hours' : 'bins'})</span>}
          </div>
          {drillState.parentRange && (
            <button
              className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded"
              onClick={handleDrillUp}
            >
              ← Back to {drillHistory.length > 0 ? LEVEL_CONFIG[drillHistory[drillHistory.length - 1].level].plural : 'All'}
            </button>
          )}
        </div>
      </div>

      {bins.length === 0 ? (
        <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400">No timestamped entries.</div>
      ) : (
        <>
          {/* Horizontal Histogram */}
          <div className="px-3 py-2">
            <HorizontalHistogram
              bins={bins}
              max={maxCount}
              onSelect={handleBinClick}
              selectedIndex={selectedBinIndex}
              currentLevel={currentLevel}
            />
          </div>

          {/* Filter Details - Always reserve space to prevent layout shift */}
          <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-700 pt-2" style={{ minHeight: '50px' }}>
            {filterStats && (
              <>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Filtered: {filterStats.totalCount.toLocaleString()} {filterStats.totalCount === 1 ? 'entry' : 'entries'}
                </div>
                <LevelBadgesFromCounts levelCounts={filterStats.levelCounts} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function HorizontalHistogram({ bins, max, onSelect, selectedIndex, currentLevel }: {
  bins: ChunkBin[]
  max: number
  onSelect: (b: ChunkBin, idx: number) => void
  selectedIndex: number | null
  currentLevel: TimelineLevel
}) {
  const scale = (v: number) => max === 0 ? 0 : Math.max(12, Math.round((v / max) * 50))
  const nextLevel = LEVEL_CONFIG[currentLevel].next

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-1.5 min-w-full pb-1" style={{ minHeight: '60px' }}>
        {bins.map((b, i) => {
          const height = scale(b.count)
          const isSelected = selectedIndex === i
          const tooltipAction = nextLevel ? `Click to drill into ${LEVEL_CONFIG[nextLevel].label}` : 'Click to filter'
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-stretch min-w-[40px] border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 p-1"
            >
              {/* Clickable bar with count inside */}
              <button
                onClick={() => onSelect(b, i)}
                className="w-full rounded transition-all relative flex items-center justify-center font-semibold text-white text-[10px]"
                style={{
                  height: `${height}px`,
                  minHeight: '24px',
                  backgroundColor: isSelected ? 'var(--accent)' : 'var(--accent)',
                  opacity: isSelected ? 0.9 : 0.5
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.75'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = isSelected ? '0.9' : '0.5'}
                title={`${formatBinTime(b, currentLevel)} • ${b.count} entries\n${tooltipAction}`}
              >
                {b.count}
              </button>

              {/* Horizontal date/time label */}
              <div className="text-[9px] text-gray-700 dark:text-gray-300 text-center mt-1 font-medium whitespace-nowrap">
                {formatBinTime(b, currentLevel)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LevelBadges({ bin }: { bin: ChunkBin }) {
  const entries = Object.entries(bin.levelCounts).filter(([_, v]) => (v ?? 0) > 0) as [string, number][]
  if (entries.length === 0) return <div className="text-[11px] text-gray-500 dark:text-gray-400">No data</div>
  const color = (lvl: string) => ({
    ERROR: 'bg-red-100 text-red-700',
    WARN: 'bg-amber-100 text-amber-700',
    INFO: 'bg-blue-100 text-blue-700',
    DEBUG: 'bg-gray-100 text-gray-700',
    TRACE: 'bg-slate-100 text-slate-700',
  } as Record<string, string>)[lvl] || 'bg-gray-100 text-gray-700'
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([lvl, count]) => (
        <span key={lvl} className={`text-[11px] px-1.5 py-0.5 rounded ${color(lvl)}`}>{lvl} {count}</span>
      ))}
    </div>
  )
}

function LevelBadgesFromCounts({ levelCounts }: { levelCounts: Record<string, number> }) {
  const entries = Object.entries(levelCounts).filter(([_, v]) => (v ?? 0) > 0) as [string, number][]
  if (entries.length === 0) return <div className="text-[11px] text-gray-500 dark:text-gray-400">No data</div>
  const color = (lvl: string) => ({
    ERROR: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100',
    WARN: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100',
    INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100',
    DEBUG: 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-100',
    TRACE: 'bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-100',
  } as Record<string, string>)[lvl] || 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-100'
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([lvl, count]) => (
        <span key={lvl} className={`text-[11px] px-1.5 py-0.5 rounded ${color(lvl)}`}>{lvl} {count.toLocaleString()}</span>
      ))}
    </div>
  )
}

function formatBinTime(b: ChunkBin, level: TimelineLevel): string {
  const start = b.start

  if (level === 'day') {
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } else if (level === 'hour') {
    return `${start.getHours()}:00`
  } else if (level === '15min') {
    return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`
  } else if (level === 'minute') {
    return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`
  } else {
    return `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}:${String(start.getSeconds()).padStart(2, '0')}`
  }
}
