import React from 'react'
import { LogEntry, LogLevel } from '../lib/types'

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

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-800 mb-3">
      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Log Summary
        </div>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Metric</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Total Lines</td>
              <td className="px-3 py-2 font-mono">
                {entries.length.toLocaleString()}
                {entries.length > maxEntriesForSummary && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    (summary based on first {maxEntriesForSummary.toLocaleString()})
                  </span>
                )}
              </td>
            </tr>
            {timeRange && (
              <>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Time Range</td>
                  <td className="px-3 py-2 font-mono">{formatTimeRange()}</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Duration</td>
                  <td className="px-3 py-2 font-mono">{formatDuration()}</td>
                </tr>
              </>
            )}
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">Log Levels</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN'] as LogLevel[]).map(level => {
                    const count = levelCounts[level] || 0
                    if (count === 0) return null
                    return (
                      <span
                        key={level}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          level === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                          level === 'WARN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' :
                          level === 'INFO' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                          level === 'DEBUG' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300' :
                          level === 'TRACE' ? 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}
                      >
                        {level}: {count.toLocaleString()}
                      </span>
                    )
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
