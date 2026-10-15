import React, { useMemo } from 'react'
import { LogEntry, LogLevel } from '../lib/types'
import GroupHeading from './GroupHeading'
import { meter } from '../lib/meter'
import { levelColorVar, levelTextClass } from '../lib/levelColors'

interface Props {
  entries: LogEntry[]
  fileName: string
  loadTime: number
}

// Big counts shortened so they fit their box (1,600,000 -> 1.6M); the box's hover shows the full number
function shortCount(n: number): string {
  return n >= 1_000_000 ? n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 }) : n.toLocaleString()
}

export default function LogSummary({ entries, fileName, loadTime }: Props) {
  // One pass over every entry: level counts and the time range
  const { levelCounts, timeRange } = useMemo(() => {
    const levelCounts = {} as Record<LogLevel, number>
    let minTime = Infinity
    let maxTime = -Infinity
    for (const entry of entries) {
      levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1
      if (entry.time) {
        const time = entry.time.getTime()
        if (time < minTime) minTime = time
        if (time > maxTime) maxTime = time
      }
    }
    const timeRange = minTime <= maxTime ? { start: new Date(minTime), end: new Date(maxTime) } : null
    return { levelCounts, timeRange }
  }, [entries])

  if (entries.length === 0) return null

  // Format time range
  const formatTimeRange = () => {
    if (!timeRange) return 'No timestamps'
    const start = timeRange.start.toLocaleString()
    const end = timeRange.end.toLocaleString()
    if (start === end) return start
    return `${start} - ${end}`
  }

  // Format duration
  const formatDuration = () => {
    if (!timeRange) return ''
    const duration = timeRange.end.getTime() - timeRange.start.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const levels = (['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN'] as LogLevel[]).filter(l => (levelCounts[l] || 0) > 0)
  const counted = entries.length

  return (
    <section className="glass card">
      <GroupHeading title="log summary" />
      <div className="stats mb-3">
        <div className="stat" title={`${entries.length.toLocaleString()} lines`}>
          <div className="num">{shortCount(entries.length)}</div>
          <div className="lbl">lines</div>
        </div>
        <div className={`stat ${(levelCounts.ERROR || 0) > 0 ? 'hl' : ''}`} title={`${(levelCounts.ERROR || 0).toLocaleString()} errors`}>
          <div className="num">{shortCount(levelCounts.ERROR || 0)}</div>
          <div className="lbl">errors</div>
        </div>
        {timeRange && (
          <div className="stat">
            <div className="num">{formatDuration()}</div>
            <div className="lbl">span</div>
          </div>
        )}
      </div>

      {/* Level breakdown as ASCII meters */}
      <div className="flex flex-col gap-0.5 text-xs">
        {levels.map(level => {
          const count = levelCounts[level] || 0
          const m = meter(counted === 0 ? 0 : count / counted)
          return (
            <div key={level} className="grid grid-cols-[52px_1fr_auto] items-center gap-2" title={`${level}: ${count.toLocaleString()}`}>
              <span className={levelTextClass(level)}>{level}</span>
              <span className="bar" style={{ color: levelColorVar(level) }}>{m.on}<span className="off">{m.off}</span></span>
              <span className="tabular-nums text-muted text-right">{count.toLocaleString()}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-line">
        <div className="lbl mb-0.5">time range</div>
        <div className="text-[11px] text-muted">{formatTimeRange()}</div>
      </div>
    </section>
  )
}
