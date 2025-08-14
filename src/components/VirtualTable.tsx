import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LogEntry } from '../lib/types'

interface Props {
  rows: LogEntry[]
  height?: number
  highlightRe?: RegExp | null
  bookmarked?: Set<number>
  onToggleBookmark?: (index: number) => void
  selectedIndex?: number | null
  onSelectRow?: (index: number) => void
}

const ROW_HEIGHT = 28 // px
const OVERSCAN = 12

function formatTime(entry: LogEntry): string {
  if (entry.time) return entry.time.toISOString()
  return entry.timeStr || ''
}

export default function VirtualTable({ rows, height = 520, highlightRe = null, bookmarked, onToggleBookmark, selectedIndex = null, onSelectRow }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [wrapLines, setWrapLines] = useState(false)
  const totalHeight = rows.length * ROW_HEIGHT

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const { start, end } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const visibleCount = Math.ceil(height / ROW_HEIGHT) + 2 * OVERSCAN
    const endIndex = Math.min(rows.length - 1, startIndex + visibleCount)
    return { start: startIndex, end: endIndex }
  }, [scrollTop, rows.length, height])

  const useVirtual = !wrapLines
  const items = useVirtual ? rows.slice(start, end + 1) : rows
  const offsetY = useVirtual ? start * ROW_HEIGHT : 0
  const gridCols = wrapLines ? 'grid-cols-[24px_200px_90px_1fr]' : 'grid-cols-[24px_200px_90px_max-content]'
  const msgCellClass = wrapLines ? 'text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words' : 'text-gray-900 dark:text-gray-100 whitespace-nowrap'

  // Copy selected row on Ctrl/Cmd + C
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== 'c') return
      const target = e.target as HTMLElement
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isTyping) return
      if (selectedIndex == null) return
      const row = rows.find(r => r.index === selectedIndex)
      if (!row) return
      const text = row.raw || `${formatTime(row)} ${row.level} ${row.message}`
      e.preventDefault()
      try { navigator.clipboard.writeText(text) } catch {}
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rows, selectedIndex])

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-800">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-100 px-3 py-2 text-xs">
            <div className={`grid ${gridCols} gap-0.5 font-semibold w-[calc(100%-8rem)]`}>
              <div title="Bookmark" className="text-center">★</div>
              <div>Time</div>
              <div>Level</div>
              <div>Message</div>
            </div>
            <button
              className="ml-3 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600"
              onClick={() => setWrapLines(w => !w)}
              title={wrapLines ? 'Switch to single-line with horizontal scroll' : 'Wrap long lines'}
            >
              {wrapLines ? 'Wrap: On' : 'Wrap: Off'}
            </button>
          </div>
          <div ref={containerRef} style={{ height }} className="relative overflow-y-auto">
            {useVirtual ? (
              <div style={{ height: totalHeight }}>
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                  {items.map((r) => (
                    <div
                      key={r.index}
                      className={`grid ${gridCols} text-[12px] px-3 items-center border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedIndex === r.index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      style={{ height: ROW_HEIGHT }}
                      title={r.message}
                      onClick={() => onSelectRow && onSelectRow(r.index)}
                      role="row"
                      aria-selected={selectedIndex === r.index}
                    >
                      <div className="text-center">
                        <button
                          className={`w-5 h-5 leading-5 text-center rounded ${bookmarked?.has(r.index) ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                          title={bookmarked?.has(r.index) ? 'Unbookmark' : 'Bookmark'}
                          onClick={(e) => { e.stopPropagation(); onToggleBookmark && onToggleBookmark(r.index) }}
                        >★</button>
                      </div>
                      <div className="tabular-nums text-gray-700 dark:text-gray-200" title={formatTime(r)}>{renderHighlight(formatTime(r), highlightRe)}</div>
                      <div className="font-medium">
                        <span className={levelColor(r.level)}>{renderHighlight(r.level, highlightRe)}</span>
                      </div>
                      <div className={msgCellClass} title={r.message}>{renderHighlight(r.message, highlightRe)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {items.map((r) => (
                  <div
                    key={r.index}
                    className={`grid ${gridCols} text-[12px] px-3 items-start border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedIndex === r.index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    title={r.message}
                    onClick={() => onSelectRow && onSelectRow(r.index)}
                    role="row"
                    aria-selected={selectedIndex === r.index}
                  >
                    <div className="text-center">
                      <button
                        className={`w-5 h-5 leading-5 text-center rounded ${bookmarked?.has(r.index) ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
                        title={bookmarked?.has(r.index) ? 'Unbookmark' : 'Bookmark'}
                        onClick={(e) => { e.stopPropagation(); onToggleBookmark && onToggleBookmark(r.index) }}
                      >★</button>
                    </div>
                    <div className="tabular-nums text-gray-700 dark:text-gray-200" title={formatTime(r)}>{renderHighlight(formatTime(r), highlightRe)}</div>
                    <div className="font-medium">
                      <span className={levelColor(r.level)}>{renderHighlight(r.level, highlightRe)}</span>
                    </div>
                    <div className={msgCellClass} title={r.message}>{renderHighlight(r.message, highlightRe)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 p-4">No log entries parsed yet.</div>
      )}
    </div>
  )
}

function levelColor(level: LogEntry['level']) {
  switch (level) {
    case 'ERROR':
      return 'text-red-600'
    case 'WARN':
      return 'text-amber-600'
    case 'INFO':
      return 'text-blue-600'
    case 'DEBUG':
      return 'text-gray-600'
    case 'TRACE':
      return 'text-slate-600'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
}

function renderHighlight(text: string, re: RegExp | null) {
  if (!re || !text) return text
  try {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    while ((m = r.exec(text)) !== null) {
      const start = m.index
      const end = start + (m[0]?.length ?? 0)
      if (end === start) { r.lastIndex++; continue }
      if (start > lastIndex) parts.push(text.slice(lastIndex, start))
      parts.push(<mark key={start} className="bg-yellow-200 text-gray-900 rounded px-0.5">{text.slice(start, end)}</mark>)
      lastIndex = end
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return <>{parts}</>
  } catch {
    return text
  }
}
