import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LogEntry, FileInfo } from '../lib/types'

interface Props {
  rows: LogEntry[]
  height?: number
  highlightRe?: RegExp | null
  bookmarked?: Set<number>
  onToggleBookmark?: (index: number) => void
  selectedIndex?: number | null
  onSelectRow?: (index: number) => void
  loadedFiles?: FileInfo[]
  showBookmarksOnly?: boolean
  onShowBookmarksOnlyChange?: (checked: boolean) => void
  bookmarkContext?: number
  onBookmarkContextChange?: (context: number) => void
  bookmarkCount?: number
}

const ROW_HEIGHT = 28 // px - height for single-line (no-wrap) rows
const ROW_HEIGHT_WRAPPED = 48 // px - estimated average height for wrapped rows (~1.5-2 lines)
const OVERSCAN = 12
const DEFAULT_HEIGHT = 600 // px - default viewport height

function formatTime(entry: LogEntry): string {
  if (entry.time) return entry.time.toISOString()
  return entry.timeStr || ''
}

export default function VirtualTable({ rows, height: propHeight, highlightRe = null, bookmarked, onToggleBookmark, selectedIndex = null, onSelectRow, loadedFiles = [], showBookmarksOnly = false, onShowBookmarksOnlyChange, bookmarkContext = 3, onBookmarkContextChange, bookmarkCount = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [wrapLines, setWrapLines] = useState(false)

  // Create a map of fileId to color for quick lookup
  const fileColorMap = useMemo(() => {
    const map = new Map<string, string>()
    loadedFiles.forEach(file => map.set(file.id, file.color))
    return map
  }, [loadedFiles])

  // Container and content height - use appropriate row height based on wrap mode
  const rowHeight = wrapLines ? ROW_HEIGHT_WRAPPED : ROW_HEIGHT
  const height = propHeight || DEFAULT_HEIGHT
  const totalHeight = rows.length * rowHeight

  // Scroll to selected row when selection changes
  useEffect(() => {
    if (selectedIndex === null || selectedIndex === undefined) return

    const container = containerRef.current
    if (!container) return

    // Find the selected row in the full dataset
    const indexInFiltered = rows.findIndex(r => r.index === selectedIndex)
    if (indexInFiltered < 0) return // Selected row not found

    // Calculate scroll position using current row height
    const targetScrollTop = indexInFiltered * rowHeight
    const containerHeight = container.clientHeight
    const currentScroll = container.scrollTop
    const rowTop = targetScrollTop
    const rowBottom = rowTop + rowHeight

    // Only scroll if the row is not already visible
    if (rowTop < currentScroll || rowBottom > currentScroll + containerHeight) {
      // Center the row in the viewport
      const centerOffset = (containerHeight / 2) - (rowHeight / 2)
      container.scrollTop = Math.max(0, targetScrollTop - centerOffset)
    }
  }, [selectedIndex, rows.length, rowHeight])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [rows.length]) // Re-run when rows change to ensure listener is attached

  const { start, end } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN)
    const visibleCount = Math.ceil(height / rowHeight) + 2 * OVERSCAN
    const endIndex = Math.min(rows.length - 1, startIndex + visibleCount)
    return { start: startIndex, end: endIndex }
  }, [scrollTop, rows.length, height, rowHeight])

  // Always use virtual scrolling for performance
  const items = rows.slice(start, end + 1)
  const offsetY = start * rowHeight
  const gridCols = wrapLines ? 'grid-cols-[24px_200px_90px_1fr]' : 'grid-cols-[24px_200px_90px_max-content]'
  const msgCellClass = wrapLines ? 'text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words' : 'text-gray-900 dark:text-gray-100 whitespace-nowrap'

  // Limit highlighting for performance with very large datasets
  const shouldHighlight = items.length <= 1000

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
            <div className={`grid ${gridCols} gap-0.5 font-semibold flex-1`}>
              <div title="Bookmark" className="text-center">★</div>
              <div>Time</div>
              <div>Level</div>
              <div>Message</div>
            </div>
            <div className="flex items-center gap-3">
              {/* Bookmark Controls (only shown when bookmarks exist) */}
              {bookmarkCount > 0 && (
                <>
                  <label className="inline-flex items-center gap-2 text-[11px] select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBookmarksOnly}
                      onChange={(e) => onShowBookmarksOnlyChange?.(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Show bookmarks only ({bookmarkCount})
                  </label>

                  {showBookmarksOnly && (
                    <div className="flex items-center gap-1">
                      <label className="text-[11px] text-gray-600 dark:text-gray-400">Context:</label>
                      <select
                        value={bookmarkContext}
                        onChange={(e) => onBookmarkContextChange?.(parseInt(e.target.value, 10))}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] bg-white dark:bg-gray-700"
                      >
                        <option value="1">±1 line</option>
                        <option value="3">±3 lines</option>
                        <option value="5">±5 lines</option>
                        <option value="10">±10 lines</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <button
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[11px] hover:bg-gray-50 dark:hover:bg-gray-600"
                onClick={() => setWrapLines(w => !w)}
                title={wrapLines ? 'Switch to single-line with horizontal scroll' : 'Wrap long lines'}
              >
                {wrapLines ? 'Wrap: On' : 'Wrap: Off'}
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">No log entries parsed yet.</div>
          ) : (
            <div ref={containerRef} style={{ height, overflow: 'auto' }} className="relative">
              {/* Spacer div to create scrollable area */}
              <div style={{ height: totalHeight, width: '100%', pointerEvents: 'none' }}></div>
              {/* Absolutely positioned content window that moves with scroll */}
              <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'auto' }}>
                {items.map((r) => {
                  const fileColor = r.fileId ? fileColorMap.get(r.fileId) : undefined
                  // Use items-start for wrapped lines to align top, items-center for single lines
                  const itemsAlign = wrapLines ? 'items-start' : 'items-center'
                  return (
                    <div
                      key={r.index}
                      className={`grid ${gridCols} text-[12px] px-3 ${itemsAlign} border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedIndex === r.index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      style={{
                        minHeight: wrapLines ? 28 : rowHeight,
                        height: wrapLines ? 'auto' : rowHeight,
                        borderLeft: fileColor ? `3px solid ${fileColor}` : undefined,
                        paddingLeft: fileColor ? '10px' : undefined,
                        paddingTop: wrapLines ? '6px' : undefined,
                        paddingBottom: wrapLines ? '6px' : undefined
                      }}
                      title={r.fileName ? `${r.fileName}: ${r.message}` : r.message}
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
                      <div className="tabular-nums text-gray-700 dark:text-gray-200" title={formatTime(r)}>{shouldHighlight ? renderHighlight(formatTime(r), highlightRe) : formatTime(r)}</div>
                      <div className="font-medium">
                        <span className={levelColor(r.level)}>{shouldHighlight ? renderHighlight(r.level, highlightRe) : r.level}</span>
                      </div>
                      <div className={msgCellClass} title={r.message}>{shouldHighlight ? renderHighlight(r.message, highlightRe) : r.message}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
         </div>
       </div>
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
    let iterations = 0
    const maxIterations = 1000 // Safety limit to prevent infinite loops
    
    while ((m = r.exec(text)) !== null && iterations < maxIterations) {
      iterations++
      const start = m.index
      const end = start + (m[0]?.length ?? 0)
      
      // Prevent infinite loop on zero-width matches
      if (end === start) { 
        r.lastIndex++
        continue 
      }
      
      // Prevent infinite loop when lastIndex doesn't advance
      if (r.lastIndex <= start) {
        r.lastIndex = start + 1
      }
      
      if (start > lastIndex) parts.push(text.slice(lastIndex, start))
      parts.push(<mark key={start} className="rounded px-0.5" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>{text.slice(start, end)}</mark>)
      lastIndex = end
    }
    
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return <>{parts}</>
  } catch {
    return text
  }
}
