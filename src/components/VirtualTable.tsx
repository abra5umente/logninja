import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LogEntry, FileInfo, entryKey } from '../lib/types'
import { levelTextClass } from '../lib/levelColors'
import { formatEntryTime } from '../lib/formatTime'
import { scrollMap } from '../lib/scrollMap'

interface Props {
  rows: LogEntry[]
  height?: number
  highlightRe?: RegExp | null
  /** Bookmarked entries, by entryKey */
  bookmarked?: Set<string>
  onToggleBookmark?: (key: string) => void
  /** Selected row, by entryKey */
  selectedKey?: string | null
  onSelectRow?: (key: string) => void
  loadedFiles?: FileInfo[]
  showBookmarksOnly?: boolean
  onShowBookmarksOnlyChange?: (checked: boolean) => void
  bookmarkContext?: number
  onBookmarkContextChange?: (context: number) => void
  bookmarkCount?: number
  // shown first among the header controls (the rows / patterns switch)
  headerControls?: React.ReactNode
}

const ROW_HEIGHT = 28 // px - height for single-line (no-wrap) rows
const ROW_HEIGHT_WRAPPED = 48 // px - starting guess for a wrapped row, replaced by its measured height once rendered
const OVERSCAN = 12
const DEFAULT_HEIGHT = 600 // px - default panel height (header + rows)
const MIN_ROW_WIDTH = 640 // px - below this the rows scroll sideways instead of squashing the message column

// Tallest the browser lets an element be, measured once (see lib/scrollMap.ts)
let maxElementHeight: number | null = null
function getMaxElementHeight(): number {
  if (maxElementHeight === null) {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1000000000px;visibility:hidden'
    document.body.appendChild(probe)
    // A little under the cap, so nothing inside the scroller runs past it
    maxElementHeight = Math.max(1_000_000, probe.offsetHeight - 1000)
    probe.remove()
  }
  return maxElementHeight
}

// Hover text for the time cell: the log's own text and the moment in UTC
function timeTitle(entry: LogEntry): string {
  return entry.time ? `${entry.timeStr} (${entry.time.toISOString()} UTC)` : entry.timeStr
}

// First position whose top edge is past y: offsets[i] is the top of row i, offsets[n] the total height
function rowAt(offsets: Float64Array, y: number): number {
  let lo = 0, hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid + 1] <= y) lo = mid + 1
    else hi = mid
  }
  return lo
}

export default function VirtualTable({ rows, height: propHeight, highlightRe = null, bookmarked, onToggleBookmark, selectedKey = null, onSelectRow, loadedFiles = [], showBookmarksOnly = false, onShowBookmarksOnlyChange, bookmarkContext = 3, onBookmarkContextChange, bookmarkCount = 0, headerControls }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(0)
  const [wrapLines, setWrapLines] = useState(false)

  // Create a map of fileId to color for quick lookup
  const fileColorMap = useMemo(() => {
    const map = new Map<string, string>()
    loadedFiles.forEach(file => map.set(file.id, file.color))
    return map
  }, [loadedFiles])

  const height = propHeight || DEFAULT_HEIGHT

  // Wrapped rows vary in height. Each rendered row is measured with a ResizeObserver and its height
  // stored by position; rows not seen yet use the guess. Heights reset whenever the rows change.
  const heights = useMemo(() => new Float64Array(rows.length).fill(ROW_HEIGHT_WRAPPED), [rows])
  const heightsRef = useRef(heights)
  heightsRef.current = heights
  const [measured, setMeasured] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const observedRef = useRef(new Set<Element>())

  const observeRow = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver(records => {
        const hs = heightsRef.current
        let changed = false
        for (const rec of records) {
          const pos = Number((rec.target as HTMLElement).dataset.pos)
          const h = rec.borderBoxSize?.[0]?.blockSize ?? (rec.target as HTMLElement).getBoundingClientRect().height
          // Only a real change triggers a re-render, so measuring settles instead of looping
          if (pos < hs.length && h > 0 && Math.abs(hs[pos] - h) > 0.5) { hs[pos] = h; changed = true }
        }
        if (changed) setMeasured(m => m + 1)
      })
    }
    if (!observedRef.current.has(el)) {
      observerRef.current.observe(el)
      observedRef.current.add(el)
    }
  }, [])

  // After each render: stop watching rows that scrolled out of the window, and re-read the ones still
  // shown, because a row React kept but moved to a new position doesn't resize, so the observer stays quiet
  useLayoutEffect(() => {
    const hs = heightsRef.current
    let changed = false
    observedRef.current.forEach(el => {
      if (!el.isConnected) { observerRef.current?.unobserve(el); observedRef.current.delete(el); return }
      const pos = Number((el as HTMLElement).dataset.pos)
      const h = el.getBoundingClientRect().height
      if (pos < hs.length && h > 0 && Math.abs(hs[pos] - h) > 0.5) { hs[pos] = h; changed = true }
    })
    if (changed) setMeasured(m => m + 1)
  })

  // Measuring only happens in wrap mode
  useEffect(() => {
    if (wrapLines) return
    observerRef.current?.disconnect()
    observerRef.current = null
    observedRef.current.clear()
  }, [wrapLines])

  // Top edge of every row (wrap mode only; single-line rows are all ROW_HEIGHT)
  const offsets = useMemo(() => {
    if (!wrapLines) return null
    const off = new Float64Array(heights.length + 1)
    for (let i = 0; i < heights.length; i++) off[i + 1] = off[i] + heights[i]
    return off
  }, [wrapLines, heights, measured])

  const rowTop = (i: number) => offsets ? offsets[i] : i * ROW_HEIGHT
  const rowHeightAt = (i: number) => offsets ? offsets[i + 1] - offsets[i] : ROW_HEIGHT
  const totalHeight = offsets ? offsets[rows.length] : rows.length * ROW_HEIGHT
  // Past about a million rows the scroll range is shorter than the rows; this maps between the two
  const map = useMemo(() => scrollMap(totalHeight, getMaxElementHeight(), viewH), [totalHeight, viewH])
  const mapRef = useRef(map)
  mapRef.current = map
  const virtualTop = map.toVirtual(scrollTop)

  // Scroll to the selected row when the selection changes. In wrap mode the rows around it only get
  // their real heights once rendered, which moves it, so it is re-centred as measurements arrive until
  // it stays put, the user scrolls, or a few tries have passed.
  const scrollTargetRef = useRef<{ key: string; tries: number } | null>(null)
  const expectedScrollRef = useRef<number | null>(null)
  useEffect(() => {
    scrollTargetRef.current = selectedKey == null ? null : { key: selectedKey, tries: 0 }
  }, [selectedKey, rows, wrapLines])
  useEffect(() => {
    const target = scrollTargetRef.current
    const container = containerRef.current
    if (!target || !container) return

    const pos = rows.findIndex(r => entryKey(r) === target.key)
    if (pos < 0) { scrollTargetRef.current = null; return } // Selected row not shown

    const top = rowTop(pos)
    const h = rowHeightAt(pos)
    const containerHeight = container.clientHeight
    const { toVirtual, toPhysical } = mapRef.current
    const shownTop = toVirtual(container.scrollTop)

    // Only scroll if the row is not already fully visible, then centre it
    if (top < shownTop || top + h > shownTop + containerHeight) {
      if (target.tries++ >= 5) { scrollTargetRef.current = null; return }
      const next = toPhysical(Math.max(0, top - (containerHeight / 2) + (h / 2)))
      expectedScrollRef.current = next
      container.scrollTop = next
    } else if (!offsets) {
      scrollTargetRef.current = null // Fixed-height rows don't move, so this is final
    }
  }, [selectedKey, rows, wrapLines, measured])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => {
      setScrollTop(el.scrollTop)
      setViewH(el.clientHeight)
      if (labelsRef.current) labelsRef.current.style.transform = `translateX(${-el.scrollLeft}px)`
    }
    const onScroll = () => {
      // The user scrolled (not us centring the selected row), so stop following the selection
      const expected = expectedScrollRef.current
      if (expected === null || Math.abs(el.scrollTop - expected) > 2) scrollTargetRef.current = null
      sync()
    }
    sync()
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [rows.length, height]) // Re-run when rows change to ensure listener is attached, and on resize to re-read the visible height

  const { start, end } = useMemo(() => {
    if (offsets) {
      const first = rowAt(offsets, virtualTop)
      const last = rowAt(offsets, virtualTop + height)
      return { start: Math.max(0, first - OVERSCAN), end: Math.min(rows.length - 1, last + OVERSCAN) }
    }
    const startIndex = Math.max(0, Math.floor(virtualTop / ROW_HEIGHT) - OVERSCAN)
    const visibleCount = Math.ceil(height / ROW_HEIGHT) + 2 * OVERSCAN
    return { start: startIndex, end: Math.min(rows.length - 1, startIndex + visibleCount) }
  }, [virtualTop, rows.length, height, offsets])

  // Always use virtual scrolling for performance
  const items = rows.slice(start, end + 1)
  // Where the first rendered row sits in the scroller: the same as its place in the rows unless the
  // scroll range is scaled, then relative to the scroll position
  const offsetY = scrollTop + rowTop(start) - virtualTop
  const gridCols = wrapLines ? 'grid-cols-[24px_50px_200px_90px_minmax(0,1fr)]' : 'grid-cols-[24px_50px_200px_90px_max-content]'
  const msgCellClass = wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap'

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
      // Text highlighted with the mouse gets copied as usual
      if (window.getSelection()?.toString()) return
      if (selectedKey == null) return
      const row = rows.find(r => entryKey(r) === selectedKey)
      if (!row) return
      const text = row.raw || `${formatEntryTime(row)} ${row.level} ${row.message}`
      e.preventDefault()
      // writeText rejects (rather than throws) when the clipboard is blocked
      navigator.clipboard?.writeText(text).catch(() => {})
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [rows, selectedKey])

  return (
    <div className="glass overflow-hidden flex flex-col" style={{ height }}>
      {/* Header stays put; only the column labels follow the rows' horizontal scroll */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-shrink-0 border-b border-line px-3 py-2">
        <div className="flex-1 basis-[300px] min-w-0 overflow-hidden">
          <div ref={labelsRef} className={`grid ${gridCols} lbl`}>
            <div title="Bookmark" className="text-center">★</div>
            <div title="Line Number" className="text-center">line</div>
            <div>time</div>
            <div>level</div>
            <div>message</div>
          </div>
        </div>
        <div className="ml-auto flex flex-shrink-0 items-center gap-3">
          {headerControls}
          {/* Bookmark Controls (only shown when bookmarks exist) */}
          {bookmarkCount > 0 && (
            <>
              <label className="inline-flex items-center gap-2 text-[11px] text-muted select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBookmarksOnly}
                  onChange={(e) => onShowBookmarksOnlyChange?.(e.target.checked)}
                  className="cursor-pointer"
                />
                bookmarks only <span className="text-accent tabular-nums">{bookmarkCount}</span>
              </label>

              {showBookmarksOnly && (
                <div className="flex items-center gap-1">
                  <label className="text-[11px] text-muted">context</label>
                  <select
                    value={bookmarkContext}
                    onChange={(e) => onBookmarkContextChange?.(parseInt(e.target.value, 10))}
                    className="in !w-auto !py-1 !text-[11px]"
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

          <div className="seg" role="radiogroup" aria-label="Line wrapping">
            <button
              className={`!py-1 ${wrapLines ? '' : 'on'}`}
              onClick={() => setWrapLines(false)}
              role="radio"
              aria-checked={!wrapLines}
              title="Single line with horizontal scroll"
            >
              nowrap
            </button>
            <button
              className={`!py-1 ${wrapLines ? 'on' : ''}`}
              onClick={() => setWrapLines(true)}
              role="radio"
              aria-checked={wrapLines}
              title="Wrap long lines"
            >
              wrap
            </button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 flex-1 min-h-0">
          <div className="empty">
            <span className="kao">(・・ ) ?</span>
            nothing to show
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="relative flex-1 min-h-0 overflow-auto">
          {/* Spacer div to create scrollable area */}
          <div style={{ height: map.spacer, width: '100%', pointerEvents: 'none' }}></div>
          {/* Absolutely positioned content window that moves with scroll */}
          {/* As wide as the longest rendered row, so row borders and highlights span the whole scroll width */}
          <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, width: wrapLines ? '100%' : 'max-content', minWidth: `max(100%, ${MIN_ROW_WIDTH}px)`, pointerEvents: 'auto' }}>
            {items.map((r, i) => {
              const fileColor = r.fileId ? fileColorMap.get(r.fileId) : undefined
              const key = entryKey(r)
              const isBookmarked = bookmarked?.has(key) ?? false
              const isSelected = selectedKey === key
              const timeText = formatEntryTime(r)
              // Use items-start for wrapped lines to align top, items-center for single lines
              const itemsAlign = wrapLines ? 'items-start' : 'items-center'
              return (
                <div
                  key={key}
                  ref={wrapLines ? observeRow : undefined}
                  data-pos={start + i}
                  className={`grid ${gridCols} text-[12px] px-3 ${itemsAlign} border-b border-line cursor-default ${isSelected ? 'bg-accent/15' : 'hover:bg-fg/5'}`}
                  style={{
                    minHeight: ROW_HEIGHT,
                    height: wrapLines ? 'auto' : ROW_HEIGHT,
                    borderLeft: fileColor ? `3px solid ${fileColor}` : undefined,
                    paddingLeft: fileColor ? '10px' : undefined,
                    paddingTop: wrapLines ? '6px' : undefined,
                    paddingBottom: wrapLines ? '6px' : undefined
                  }}
                  title={r.fileName ? `${r.fileName}: ${r.message}` : r.message}
                  onClick={() => onSelectRow && onSelectRow(key)}
                  role="row"
                  aria-selected={isSelected}
                >
                  <div className="text-center">
                    <button
                      className={`w-5 h-5 leading-5 text-center rounded-chip ${isBookmarked ? 'text-accent' : 'text-muted/50 hover:text-fg'}`}
                      title={isBookmarked ? 'Unbookmark' : 'Bookmark'}
                      onClick={(e) => { e.stopPropagation(); onToggleBookmark && onToggleBookmark(key) }}
                    >★</button>
                  </div>
                  <div className="text-center text-muted text-[11px] tabular-nums" title={r.fileName ? `${r.fileName}, line ${r.line}` : `Line ${r.line}`}>{r.line}</div>
                  <div className="tabular-nums text-muted" title={timeTitle(r)}>{shouldHighlight ? renderHighlight(timeText, highlightRe) : timeText}</div>
                  <div className="font-semibold">
                    <span className={levelTextClass(r.level)}>{shouldHighlight ? renderHighlight(r.level, highlightRe) : r.level}</span>
                  </div>
                  <div className={msgCellClass} title={r.message}>{shouldHighlight ? renderHighlight(r.message, highlightRe) : r.message}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
      parts.push(<mark key={start} className="rounded-chip px-0.5 bg-accent text-bg">{text.slice(start, end)}</mark>)
      lastIndex = end
    }
    
    if (lastIndex < text.length) parts.push(text.slice(lastIndex))
    return <>{parts}</>
  } catch {
    return text
  }
}
