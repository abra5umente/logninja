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

export default function TimelinePanel({ entries, binMs, setBinMs, onSelectRange, activeRange }: Props) {
  const bins = useMemo(() => groupByBinsMs(entries, binMs), [entries, binMs])
  const maxCount = useMemo(() => bins.reduce((m, b) => Math.max(m, b.count), 0), [bins])
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(() => {
    const saved = localStorage.getItem('timelinePageSize')
    return saved ? parseInt(saved, 10) : 25
  })
  
  // Pagination logic
  const pageSize = userPageSize
  const totalPages = Math.ceil(bins.length / pageSize)
  const shouldPaginate = bins.length > 20
  
  // Get current page data
  const getCurrentPageData = () => {
    if (!shouldPaginate) return bins
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return bins.slice(startIndex, endIndex)
  }
  
  const currentPageData = getCurrentPageData()
  
  // Save user preference to localStorage
  React.useEffect(() => {
    localStorage.setItem('timelinePageSize', userPageSize.toString())
  }, [userPageSize])

  // Reset to first page when bins change or page size changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [bins.length, userPageSize])

  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(i)) n.delete(i); else n.add(i)
    return n
  })

  const formatRange = (b: ChunkBin) => `${fmtTime(b.start)} - ${fmtTime(b.end)}`

  return (
    <aside className="w-full md:w-80 lg:w-96 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col rounded-md">
      <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 px-3 py-2 text-xs">
        <div className="text-sm font-semibold">Timeline</div>
        <div className="flex items-center gap-2">
          <label className="text-[11px]">Chunk by</label>
          <select
            className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value={binMs}
            onChange={(e) => setBinMs(parseInt(e.target.value, 10))}
          >
            <option value={1000}>1 sec</option>
            <option value={5000}>5 sec</option>
            <option value={15000}>15 sec</option>
            <option value={30000}>30 sec</option>
            <option value={60000}>1 min</option>
            <option value={300000}>5 min</option>
            <option value={900000}>15 min</option>
          </select>
        </div>
        {shouldPaginate && (
          <div className="flex items-center gap-2">
            <label className="text-[11px]">Show</label>
            <select
              className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              value={userPageSize}
              onChange={(e) => setUserPageSize(parseInt(e.target.value, 10))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

      </div>
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        {activeRange ? (
          <div className="flex items-center justify-between text-xs">
            <div className="text-gray-700 dark:text-gray-300">Filtered: {fmtTime(activeRange.start)} - {fmtTime(activeRange.end)}</div>
            <button className="text-[var(--accent)] hover:underline" onClick={() => onSelectRange(null)}>Clear</button>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">Click a bar to filter</div>
        )}
      </div>
      
      {shouldPaginate && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            title="Previous page"
          >
            ←
          </button>
          <span className="text-[11px] text-gray-600 dark:text-gray-300">
            {currentPage} / {totalPages}
          </span>
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            →
          </button>
        </div>
      )}

      <div className="p-3 flex-shrink-0">
        <Histogram bins={currentPageData} max={maxCount} onSelect={(b) => onSelectRange({ start: b.start, end: b.end })} />
      </div>

      <div className="px-3 pb-3 overflow-auto flex-1 min-h-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Chunks</div>
          {shouldPaginate && (
            <select
              className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-[120px]"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const chunkIndex = parseInt(e.target.value, 10)
                  const targetPage = Math.floor(chunkIndex / userPageSize) + 1
                  setCurrentPage(targetPage)
                  e.target.value = "" // Reset selection
                }
              }}
            >
              <option value="">Jump to chunk...</option>
              {bins.map((bin, index) => (
                <option key={index} value={index}>
                  {fmtTime(bin.start)} - {fmtTime(bin.end)} ({bin.count})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="border border-gray-100 dark:border-gray-700 rounded">
          {currentPageData.map((b, i) => {
            const globalIndex = shouldPaginate ? (currentPage - 1) * pageSize + i : i
            return (
              <div key={globalIndex}>
                <button
                  onClick={() => toggle(globalIndex)}
                  className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                  title="Toggle chunk details"
                >
                  <div className="text-[12px] text-gray-800 dark:text-gray-200 truncate">{formatRange(b)}</div>
                  <div className="text-[12px] text-gray-600 dark:text-gray-400">{b.count}</div>
                </button>
                {open.has(globalIndex) && (
                  <div className="px-2 pb-2">
                    <LevelBadges bin={b} />
                    <button
                      onClick={() => onSelectRange({ start: b.start, end: b.end })}
                      className="mt-2 text-xs text-[var(--accent)] hover:underline"
                    >Filter to this range</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {shouldPaginate && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              title="Previous page"
            >
              ←
            </button>
            <span className="text-[11px] text-gray-600 dark:text-gray-300">
              {currentPage} / {totalPages}
            </span>
            <button
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              →
            </button>
          </div>
        )}
        {shouldPaginate && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Showing {pageSize} chunks per page
          </div>
        )}
      </div>
    </aside>
  )
}

function Histogram({ bins, max, onSelect }: { bins: ChunkBin[]; max: number; onSelect: (b: ChunkBin) => void }) {
  const scale = (v: number) => max === 0 ? 0 : Math.max(2, Math.round((v / max) * 100))
  return (
    <div className="space-y-1">
      {bins.map((b, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <div className="w-24 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{fmtTime(b.start)}</div>
          <div className="flex-1 relative">
            <button
              onClick={() => onSelect(b)}
              className="h-4 rounded transition-colors absolute left-0 top-0"
              style={{ 
                width: `${Math.min(scale(b.count), 100)}%`,
                backgroundColor: 'var(--accent)',
                opacity: 0.2
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.3'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.2'}
              title={`${fmtTime(b.start)} • ${b.count} entries`}
            />
          </div>
          <div className="text-[11px] text-gray-600 dark:text-gray-400 w-6 text-right">{b.count}</div>
        </div>
      ))}
      {bins.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">No timestamped entries.</div>
      )}
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

function fmtTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
