import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LogEntry, LogLevel } from '../lib/types'
import { MIN_BIN_MS, TimeRange, TimelineBin, buildBins, formatRange, formatStep, formatTick, pickBinMs, sameLocalDay, timeExtent } from '../lib/time'
import { levelColorVar } from '../lib/levelColors'

interface Props {
  // rows after the file, level and search filters, but before the time range
  entries: LogEntry[]
  // set in find / highlight mode: search hits get their own strip under the bars
  isMatch?: ((e: LogEntry) => boolean) | null
  onSelectRange: (range: TimeRange | null) => void
  activeRange?: TimeRange | null
}

// Bottom to top. Errors and warnings sit on the baseline so they're easy to compare across bars.
const STACK_ORDER: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']
const CHART_H = 64
const LABEL_PX = 84
// rough width of one axis-label character (10px monospace)
const CHAR_PX = 6.2

const overlaps = (b: TimelineBin, r: TimeRange) => b.start < r.end && b.end > r.start

function sumBins(bins: TimelineBin[]) {
  const levelCounts: Partial<Record<LogLevel, number>> = {}
  let count = 0
  let matches = 0
  for (const b of bins) {
    count += b.count
    matches += b.matches
    for (const lvl of STACK_ORDER) {
      const c = b.levelCounts[lvl]
      if (c) levelCounts[lvl] = (levelCounts[lvl] ?? 0) + c
    }
  }
  return { count, matches, levelCounts }
}

export default function TimelinePanel({ entries, isMatch, onSelectRange, activeRange }: Props) {
  // view: the stretch of time the bars cover (null = everything). history powers "zoom out".
  const [view, setView] = useState<TimeRange | null>(null)
  const [history, setHistory] = useState<(TimeRange | null)[]>([])
  const [hover, setHover] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartW, setChartW] = useState(600)

  // Something else cleared the time range (reset filters, the palette): go back to the full view.
  useEffect(() => {
    if (!activeRange && (view || history.length)) {
      setView(null)
      setHistory([])
    }
  }, [activeRange])

  const extent = useMemo(() => timeExtent(entries), [entries])
  const untimed = useMemo(() => {
    let c = 0
    for (const e of entries) if (!e.time) c++
    return c
  }, [entries])

  const shown = view ?? extent
  const binMs = shown ? pickBinMs(shown.end.getTime() - shown.start.getTime()) : MIN_BIN_MS
  const bins = useMemo(
    () => (shown ? buildBins(entries, shown, binMs, isMatch) : []),
    [entries, shown?.start.getTime(), shown?.end.getTime(), binMs, isMatch],
  )
  const maxCount = useMemo(() => bins.reduce((m, b) => Math.max(m, b.count), 0), [bins])
  const maxMatches = useMemo(() => bins.reduce((m, b) => Math.max(m, b.matches), 0), [bins])

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const measure = () => setChartW(el.getBoundingClientRect().width || 600)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [bins.length > 0])

  // keep hover / keyboard cursor inside the bars when the view changes
  useEffect(() => { setHover(null) }, [bins])

  const zoomTo = (range: TimeRange) => {
    setHistory(h => [...h, view])
    setView(range)
    onSelectRange(range)
  }

  const pickBin = (i: number) => {
    const bin = bins[i]
    if (!bin) return
    // a one-second bar can't be split further: just filter to it
    if (binMs <= MIN_BIN_MS) onSelectRange({ start: bin.start, end: bin.end })
    else zoomTo({ start: bin.start, end: bin.end })
  }

  const zoomOut = () => {
    // a single bar picked inside the current view: drop back to the whole view first
    if (view && activeRange && (activeRange.start.getTime() !== view.start.getTime() || activeRange.end.getTime() !== view.end.getTime())) {
      onSelectRange(view)
      return
    }
    const prev = history.length ? history[history.length - 1] : null
    setHistory(h => h.slice(0, -1))
    setView(prev)
    onSelectRange(prev)
  }

  const reset = () => {
    setView(null)
    setHistory([])
    onSelectRange(null)
  }

  const binAt = (clientX: number) => {
    const el = chartRef.current
    if (!el || bins.length === 0) return 0
    const r = el.getBoundingClientRect()
    const i = Math.floor(((clientX - r.left) / r.width) * bins.length)
    return Math.min(bins.length - 1, Math.max(0, i))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const i = binAt(e.clientX)
    setDrag({ a: i, b: i })
    setHover(i)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const i = binAt(e.clientX)
    setHover(i)
    if (drag && drag.b !== i) setDrag({ a: drag.a, b: i })
  }
  const onPointerUp = () => {
    if (!drag) return
    const lo = Math.min(drag.a, drag.b)
    const hi = Math.max(drag.a, drag.b)
    setDrag(null)
    if (lo === hi) pickBin(lo)
    else zoomTo({ start: bins[lo].start, end: bins[hi].end })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (bins.length === 0) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const step = e.key === 'ArrowRight' ? 1 : -1
      setHover(h => Math.min(bins.length - 1, Math.max(0, (h ?? (step > 0 ? -1 : bins.length)) + step)))
    } else if (e.key === 'Enter' && hover !== null) {
      e.preventDefault()
      pickBin(hover)
    } else if (e.key === 'Backspace' && (view || activeRange)) {
      e.preventDefault()
      zoomOut()
    }
  }

  const dragLo = drag ? Math.min(drag.a, drag.b) : -1
  const dragHi = drag ? Math.max(drag.a, drag.b) : -1
  const showMatches = !!isMatch

  // What the line above the bars says: the dragged span, the hovered bar, or the selection.
  const readout = useMemo(() => {
    if (bins.length === 0) return null
    if (drag && dragLo !== dragHi) {
      const span = bins.slice(dragLo, dragHi + 1)
      return { label: 'release to zoom into', range: { start: span[0].start, end: span[span.length - 1].end }, ...sumBins(span) }
    }
    if (hover !== null && bins[hover]) {
      const b = bins[hover]
      return { label: '', range: { start: b.start, end: b.end }, count: b.count, matches: b.matches, levelCounts: b.levelCounts }
    }
    if (activeRange) {
      return { label: 'selected', range: activeRange, ...sumBins(bins.filter(b => overlaps(b, activeRange))) }
    }
    return { label: 'all', range: { start: bins[0].start, end: bins[bins.length - 1].end }, ...sumBins(bins) }
  }, [bins, hover, drag, dragLo, dragHi, activeRange])

  const labelEvery = Math.max(1, Math.ceil(LABEL_PX / (chartW / Math.max(1, bins.length))))
  const ticks: { i: number; text: string }[] = []
  const barW = chartW / Math.max(1, bins.length)
  let prevTick: Date | null = null
  let prevEnd = -Infinity
  for (let i = 0; i < bins.length; i += labelEvery) {
    const d = bins[i].start
    const text = formatTick(d, binMs, !prevTick || !sameLocalDay(prevTick, d))
    const x = i * barW
    const w = text.length * CHAR_PX + 8
    // skip a label that would overlap the previous one (a dated label is wider) or run off the right edge
    if (x < prevEnd || (i !== 0 && x + w > chartW)) continue
    ticks.push({ i, text })
    prevTick = d
    prevEnd = x + w
  }

  const zoomed = !!view || !!activeRange

  return (
    <div className="glass w-full flex-shrink-0 px-3 pt-3 pb-2">
      <div className="group-h !mb-1">
        <b>timeline</b>
        <span className="rule" />
        {zoomed && (
          <>
            {(history.length > 0 || (activeRange && view)) && (
              <button className="link whitespace-nowrap flex-shrink-0" onClick={zoomOut}>← zoom out</button>
            )}
            <button className="link whitespace-nowrap flex-shrink-0" onClick={reset}>show all</button>
          </>
        )}
      </div>

      {bins.length === 0 ? (
        <div className="empty text-xs">
          <span className="kao">(￣～￣;)</span>
          no timestamped entries
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 text-[11px] text-muted mb-1 min-w-0">
            <span className="truncate">
              1 bar = <span className="text-fg">{formatStep(binMs)}</span>
              <span className="hidden sm:inline"> · click a bar to zoom in, drag across bars to pick a range</span>
            </span>
            <span className="flex-1" />
            {showMatches && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span className="inline-block w-3 h-1 rounded-chip bg-accent" /> search hits
              </span>
            )}
            {untimed > 0 && (
              <span className="whitespace-nowrap" title="rows with no timestamp can't be placed on the timeline">
                {untimed.toLocaleString()} without a time
              </span>
            )}
          </div>

          {readout && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] min-h-[18px] mb-1">
              {readout.label && <span className="lbl">{readout.label}</span>}
              <span className="text-fg tabular-nums">{formatRange(readout.range, binMs)}</span>
              <span className="text-muted">·</span>
              <span className="tabular-nums"><span className="text-fg font-semibold">{readout.count.toLocaleString()}</span> <span className="text-muted">{readout.count === 1 ? 'entry' : 'entries'}</span></span>
              {STACK_ORDER.filter(l => readout.levelCounts[l]).map(l => (
                <span key={l} className="inline-flex items-center gap-1 tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: levelColorVar(l) }} />
                  <span className="text-muted">{l.toLowerCase()}</span> {readout.levelCounts[l]!.toLocaleString()}
                </span>
              ))}
              {showMatches && (
                <span className="tabular-nums text-accent">{readout.matches.toLocaleString()} {readout.matches === 1 ? 'hit' : 'hits'}</span>
              )}
            </div>
          )}

          <div
            ref={chartRef}
            role="slider"
            tabIndex={0}
            aria-label="timeline: arrow keys move between bars, enter zooms in, backspace zooms out"
            aria-valuemin={0}
            aria-valuemax={bins.length - 1}
            aria-valuenow={hover ?? 0}
            aria-valuetext={readout ? formatRange(readout.range, binMs) : undefined}
            className="relative select-none cursor-crosshair outline-none rounded-inner focus-visible:ring-1 focus-visible:ring-accent touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            onPointerLeave={() => { if (!drag) setHover(null) }}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-end border-b border-line-strong" style={{ height: CHART_H, gap: bins.length > 120 ? 0 : 2 }}>
              {bins.map((b, i) => {
                const h = b.count === 0 ? 0 : Math.max(3, Math.round((b.count / maxCount) * CHART_H))
                const inDrag = i >= dragLo && i <= dragHi
                const dimmed = !drag && activeRange && !overlaps(b, activeRange)
                const lit = hover === i || inDrag
                return (
                  <div
                    key={b.start.getTime()}
                    className={`relative flex-1 h-full flex items-end min-w-0 ${inDrag ? 'bg-accent/15' : ''}`}
                    style={{ opacity: dimmed ? 0.3 : 1 }}
                  >
                    {lit && <div className="absolute inset-0 bg-fg/5 pointer-events-none" />}
                    <div className="w-full flex flex-col-reverse overflow-hidden rounded-t-[2px]" style={{ height: h }}>
                      {STACK_ORDER.map(l => {
                        const c = b.levelCounts[l]
                        if (!c) return null
                        return (
                          <div
                            key={l}
                            style={{
                              flex: `${c} 0 0`,
                              // a few errors in a busy bar should still show up
                              minHeight: l === 'ERROR' || l === 'WARN' ? 2 : 0,
                              background: levelColorVar(l),
                              opacity: lit ? 1 : 0.8,
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {showMatches && (
              <div className="flex mt-[3px]" style={{ height: 4, gap: bins.length > 120 ? 0 : 2 }}>
                {bins.map(b => (
                  <div
                    key={b.start.getTime()}
                    className="flex-1 rounded-chip bg-accent"
                    style={{ opacity: b.matches === 0 ? 0 : 0.3 + 0.7 * (b.matches / Math.max(1, maxMatches)) }}
                  />
                ))}
              </div>
            )}

            <div className="relative h-4 mt-1 text-[10px] text-muted tabular-nums overflow-hidden">
              {ticks.map(t => (
                <span
                  key={t.i}
                  className="absolute top-0 whitespace-nowrap pl-1 border-l border-line-strong leading-none pt-0.5"
                  style={{ left: `${(t.i / bins.length) * 100}%` }}
                >
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
