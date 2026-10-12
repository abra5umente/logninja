import React, { useMemo, useState } from 'react'
import { LogEntry, ChunkBin } from '../lib/types'
import { groupByBinsMs } from '../lib/time'
import { levelColorVar } from '../lib/levelColors'

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

  // Handle clear filter - reset both range and drill state
  const handleClearFilter = () => {
    onSelectRange(null)
    setDrillState({ level: 'day', parentRange: null })
    setDrillHistory([])
    setSelectedBinIndex(null)
  }

  return (
    <div className="glass w-full flex-shrink-0" style={{ minHeight: '120px' }}>
      <div className="px-3 pt-3">
        <div className="group-h !mb-2">
          <b>timeline</b>
          <span className="rule" />
          {activeRange && (
            <button className="link whitespace-nowrap flex-shrink-0" onClick={handleClearFilter}>clear filter</button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <div>
            viewing <span className="font-semibold text-fg">{LEVEL_CONFIG[currentLevel].label.toLowerCase()}</span>
            {bins.length > 0 && <span className="ml-1 tabular-nums">({bins.length} {currentLevel === 'day' ? 'days' : currentLevel === 'hour' ? 'hours' : 'bins'})</span>}
          </div>
          {drillState.parentRange && (
            <button
              className="btn !text-[11px] !py-0.5 !px-2"
              onClick={handleDrillUp}
            >
              ← back to {drillHistory.length > 0 ? LEVEL_CONFIG[drillHistory[drillHistory.length - 1].level].plural.toLowerCase() : 'all'}
            </button>
          )}
        </div>
      </div>

      {bins.length === 0 ? (
        <div className="p-3">
          <div className="empty text-xs">
            <span className="kao">(￣～￣;)</span>
            no timestamped entries
          </div>
        </div>
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
          <div className="px-3 pb-2 border-t border-line pt-2" style={{ minHeight: '50px' }}>
            {filterStats && (
              <>
                <div className="text-xs mb-1">
                  <span className="lbl mr-2">filtered</span>
                  <span className="font-semibold tabular-nums">{filterStats.totalCount.toLocaleString()}</span> {filterStats.totalCount === 1 ? 'entry' : 'entries'}
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
              className={`flex-1 flex flex-col items-stretch justify-end min-w-[40px] rounded-inner p-1 border ${isSelected ? 'border-accent bg-accent/10' : 'border-transparent bg-bg/45'}`}
            >
              {/* Clickable bar with count inside */}
              <button
                onClick={() => onSelect(b, i)}
                className={`w-full rounded-chip transition-colors relative flex items-center justify-center font-semibold text-[10px] tabular-nums ${
                  isSelected ? 'bg-accent text-bg' : 'bg-accent/35 text-fg hover:bg-accent/60'
                }`}
                style={{
                  height: `${height}px`,
                  minHeight: '24px'
                }}
                title={`${formatBinTime(b, currentLevel)} • ${b.count} entries\n${tooltipAction}`}
              >
                {b.count}
              </button>

              {/* Horizontal date/time label */}
              <div className={`text-[9px] text-center mt-1 whitespace-nowrap tabular-nums ${isSelected ? 'text-fg font-semibold' : 'text-muted'}`}>
                {formatBinTime(b, currentLevel)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LevelBadgesFromCounts({ levelCounts }: { levelCounts: Record<string, number> }) {
  const entries = Object.entries(levelCounts).filter(([_, v]) => (v ?? 0) > 0) as [string, number][]
  if (entries.length === 0) return <div className="text-[11px] text-muted">no data</div>
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([lvl, count]) => (
        <span key={lvl} className="inline-flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-chip border border-line bg-bg/45">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: levelColorVar(lvl) }} />
          {lvl} <span className="tabular-nums text-muted">{count.toLocaleString()}</span>
        </span>
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
