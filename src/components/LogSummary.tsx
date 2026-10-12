import React from 'react'
import { LogEntry, LogLevel } from '../lib/types'
import GroupHeading from './GroupHeading'
import { meter } from '../lib/meter'
import { levelColorVar, levelTextClass } from '../lib/levelColors'

interface Props {
  entries: LogEntry[]
  fileName: string
  loadTime: number
}

export default function LogSummary({ entries, fileName, loadTime }: Props) {
  if (entries.length === 0) return null

  // Performance optimization: limit processing for extremely large datasets
  const maxEntriesForSummary = 1000000 // 1 million entries max
  const entriesToProcess = entries.length > maxEntriesForSummary ? entries.slice(0, maxEntriesForSummary) : entries

  // Calculate level counts
  const levelCounts = entriesToProcess.reduce((acc, entry) => {
    acc[entry.level] = (acc[entry.level] || 0) + 1
    return acc
  }, {} as Record<LogLevel, number>)

  // Calculate time range efficiently for large datasets
  let minTime = Infinity
  let maxTime = -Infinity
  let hasTimestamps = false
  
  for (const entry of entriesToProcess) {
    if (entry.time) {
      const time = entry.time.getTime()
      minTime = Math.min(minTime, time)
      maxTime = Math.max(maxTime, time)
      hasTimestamps = true
    }
  }
  
  const timeRange = hasTimestamps ? {
    start: new Date(minTime),
    end: new Date(maxTime)
  } : null

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
  const counted = entriesToProcess.length

  return (
    <section className="glass card">
      <GroupHeading title="log summary" />
      <div className="stats mb-3">
        <div className="stat">
          <div className="num">{entries.length.toLocaleString()}</div>
          <div className="lbl">lines</div>
        </div>
        <div className={`stat ${(levelCounts.ERROR || 0) > 0 ? 'hl' : ''}`}>
          <div className="num">{(levelCounts.ERROR || 0).toLocaleString()}</div>
          <div className="lbl">errors</div>
        </div>
        {timeRange && (
          <div className="stat">
            <div className="num">{formatDuration()}</div>
            <div className="lbl">span</div>
          </div>
        )}
      </div>

      {entries.length > maxEntriesForSummary && (
        <div className="text-[11px] text-yellow mb-2">
          summary based on the first {maxEntriesForSummary.toLocaleString()} lines
        </div>
      )}

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
