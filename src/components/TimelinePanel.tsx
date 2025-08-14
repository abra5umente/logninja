import React, { useMemo, useState } from 'react'
import { LogEntry, ChunkBin } from '../lib/types'
import { groupByBinsMs } from '../lib/time'

interface Props {
  entries: LogEntry[]
  binMs: number
  setBinMs: (ms: number) => void
  onSelectRange: (range: { start: Date; end: Date } | null) => void
  activeRange?: { start: Date; end: Date } | null
}

export default function TimelinePanel({ entries, binMs, setBinMs, onSelectRange, activeRange }: Props) {
  const bins = useMemo(() => groupByBinsMs(entries, binMs), [entries, binMs])
  const maxCount = useMemo(() => bins.reduce((m, b) => Math.max(m, b.count), 0), [bins])
  const [open, setOpen] = useState<Set<number>>(new Set())

  const toggle = (i: number) => setOpen(prev => {
    const n = new Set(prev)
    if (n.has(i)) n.delete(i); else n.add(i)
    return n
  })

  const formatRange = (b: ChunkBin) => `${fmtTime(b.start)} - ${fmtTime(b.end)}`

  return (
    <aside className="w-full md:w-80 lg:w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Timeline</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400">Chunk by</label>
          <select
            className="text-sm border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-700"
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
      </div>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        {activeRange ? (
          <div className="flex items-center justify-between text-xs">
            <div className="text-gray-700 dark:text-gray-300">Filtered: {fmtTime(activeRange.start)} - {fmtTime(activeRange.end)}</div>
            <button className="text-blue-600 hover:underline" onClick={() => onSelectRange(null)}>Clear</button>
          </div>
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">Click a bar to filter</div>
        )}
      </div>

      <div className="p-3">
        <Histogram bins={bins} max={maxCount} onSelect={(b) => onSelectRange({ start: b.start, end: b.end })} />
      </div>

      <div className="px-3 pb-3 overflow-auto" style={{ maxHeight: 320 }}>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Chunks</div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded">
          {bins.map((b, i) => (
            <div key={i}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between text-left px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Toggle chunk details"
              >
                <div className="text-[12px] text-gray-800 dark:text-gray-200 truncate">{formatRange(b)}</div>
                <div className="text-[12px] text-gray-600 dark:text-gray-400">{b.count}</div>
              </button>
              {open.has(i) && (
                <div className="px-2 pb-2">
                  <LevelBadges bin={b} />
                  <button
                    onClick={() => onSelectRange({ start: b.start, end: b.end })}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >Filter to this range</button>
                </div>
              )}
            </div>
          ))}
        </div>
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
          <button
            onClick={() => onSelect(b)}
            className="h-4 bg-blue-200 hover:bg-blue-300 rounded transition-colors"
            style={{ width: `${scale(b.count)}%` }}
            title={`${fmtTime(b.start)} • ${b.count} entries`}
          />
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
