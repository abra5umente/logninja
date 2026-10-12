import React, { useEffect, useMemo, useState } from 'react'
import { LogEntry, LogLevel } from '../lib/types'
import { Pattern, PatternGroups, PatternSort, groupRows, newPatternGroups, rankPatterns, sparkline, templateParts, templateToRegex } from '../lib/patterns'
import { meter } from '../lib/meter'
import { levelColorVar } from '../lib/levelColors'

interface Props {
  rows: LogEntry[]
  height: number
  onShowRows: (regex: string) => void
  onJumpTo: (index: number) => void
  headerControls?: React.ReactNode
}

const MAX_SHOWN = 300
// sparklines for this many patterns, so filtering the list rarely uncovers one without
const SPARK_LIMIT = 20_000
// up to this many rows are grouped in one go; more are grouped a slice per tick so the page
// stays responsive (roughly 4µs a line)
const SYNC_ROWS = 50_000
const SLICE_ROWS = 25_000
const LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']
const SORTS: { id: PatternSort; label: string; title: string }[] = [
  { id: 'common', label: 'most', title: 'Most frequent first' },
  { id: 'rare', label: 'rarest', title: 'One-offs first: the odd lines out' },
  { id: 'errors', label: 'errors', title: 'Most errors, then warnings, first' },
  { id: 'latest', label: 'newest', title: 'Patterns that first appeared latest come first' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const day = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function seen(p: Pattern): string {
  if (!p.first || !p.last) return 'no time'
  if (p.first.getTime() === p.last.getTime()) return `${day(p.first)} ${clock(p.first)}`
  const sameDay = p.first.toDateString() === p.last.toDateString()
  return `${day(p.first)} ${clock(p.first)} – ${sameDay ? '' : day(p.last) + ' '}${clock(p.last)}`
}

function worstLevel(p: Pattern): LogLevel | null {
  if (p.levelCounts.ERROR) return 'ERROR'
  if (p.levelCounts.WARN) return 'WARN'
  return null
}

function usePatternGroups(rows: LogEntry[]): { groups: PatternGroups | null; progress: number } {
  const sync = useMemo(() => {
    if (rows.length > SYNC_ROWS) return null
    const g = newPatternGroups(rows.length)
    groupRows(g, rows)
    return g
  }, [rows])
  const [async, setAsync] = useState<{ rows: LogEntry[]; groups: PatternGroups } | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (sync) return
    const g = newPatternGroups(rows.length)
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      if (groupRows(g, rows, SLICE_ROWS)) setAsync({ rows, groups: g })
      else {
        setProgress(g.done / rows.length)
        timer = setTimeout(step, 0)
      }
    }
    setProgress(0)
    timer = setTimeout(step, 0)
    return () => clearTimeout(timer)
  }, [rows, sync])

  return { groups: sync ?? (async && async.rows === rows ? async.groups : null), progress }
}

export default function PatternsPanel({ rows, height, onShowRows, onJumpTo, headerControls }: Props) {
  const [sort, setSort] = useState<PatternSort>('common')
  const [text, setText] = useState('')

  const { groups, progress } = usePatternGroups(rows)
  const ranked = useMemo(() => (groups ? rankPatterns(groups, rows, sort, SPARK_LIMIT) : null), [groups, sort])
  const patterns = ranked?.patterns ?? []
  const matching = useMemo(() => {
    const q = text.trim().toLowerCase()
    return q ? patterns.filter(p => p.template.toLowerCase().includes(q)) : patterns
  }, [patterns, text])
  const shown = matching.slice(0, MAX_SHOWN)
  const total = rows.length

  return (
    <div className="glass overflow-hidden flex flex-col" style={{ height }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-shrink-0 border-b border-line px-3 py-2">
        <div className="text-[11px] text-muted whitespace-nowrap">
          <span className="text-fg font-semibold tabular-nums">{patterns.length.toLocaleString()}</span> {patterns.length === 1 ? 'pattern' : 'patterns'} from{' '}
          <span className="text-fg tabular-nums">{total.toLocaleString()}</span> rows
        </div>
        <input
          className="in !w-44 !py-1 !text-[11px]"
          placeholder="filter patterns…"
          value={text}
          onChange={e => setText(e.target.value)}
          aria-label="Filter patterns"
        />
        <div className="ml-auto flex flex-shrink-0 items-center gap-3">
          <div className="seg" role="radiogroup" aria-label="Sort patterns">
            {SORTS.map(s => (
              <button
                key={s.id}
                className={`!py-1 !px-2 ${sort === s.id ? 'on' : ''}`}
                onClick={() => setSort(s.id)}
                role="radio"
                aria-checked={sort === s.id}
                title={s.title}
              >
                {s.label}
              </button>
            ))}
          </div>
          {headerControls}
        </div>
      </div>

      {!groups ? (
        <div className="p-4 flex-1 min-h-0">
          <div className="empty">
            <span className="kao">(•̀ᴗ•́)و</span>
            grouping {total.toLocaleString()} lines…
            <span className="bar tabular-nums block mt-1">{meter(progress).on}<span className="off">{meter(progress).off}</span> {Math.round(progress * 100)}%</span>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="p-4 flex-1 min-h-0">
          <div className="empty">
            <span className="kao">(・・ ) ?</span>
            {patterns.length === 0 ? 'nothing to group' : 'no pattern matches that filter'}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {shown.map(p => {
            const worst = worstLevel(p)
            const share = total ? p.count / total : 0
            const spark = ranked?.sparks.get(p)
            return (
              <div
                key={p.template}
                className="group grid grid-cols-[64px_minmax(0,1fr)_auto] gap-x-3 items-start px-3 py-1.5 border-b border-line text-[12px] cursor-pointer hover:bg-fg/5"
                style={{ boxShadow: worst ? `inset 2px 0 0 ${levelColorVar(worst)}` : undefined }}
                onClick={() => onShowRows(templateToRegex(p.template))}
                title="Click to show these rows"
              >
                <div className="text-right tabular-nums">
                  <div className="text-fg font-semibold">{p.count.toLocaleString()}</div>
                  <div className="text-[10px] text-muted">{share >= 0.001 ? `${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%` : '<0.1%'}</div>
                </div>

                <div className="min-w-0">
                  <div className="break-words whitespace-pre-wrap leading-5">
                    {templateParts(p.template).map((part, i) =>
                      part.placeholder
                        ? <span key={i} className="px-1 mx-px rounded-chip bg-accent/15 text-accent text-[11px]">{part.text}</span>
                        : <span key={i}>{part.text}</span>,
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted tabular-nums">
                    {LEVELS.filter(l => p.levelCounts[l]).map(l => (
                      <span key={l} className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: levelColorVar(l) }} />
                        {l.toLowerCase()} {p.levelCounts[l]!.toLocaleString()}
                      </span>
                    ))}
                    <span>{seen(p)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  {spark && (
                    <span
                      className="whitespace-pre text-accent leading-4 border-b border-line"
                      title="when this pattern shows up, across the time span of the rows shown"
                    >
                      {sparkline(spark)}
                    </span>
                  )}
                  <button
                    className="link opacity-60 group-hover:opacity-100"
                    onClick={e => { e.stopPropagation(); onJumpTo(p.firstIndex) }}
                    title="Show the first row of this pattern in the log"
                  >
                    first row
                  </button>
                </div>
              </div>
            )
          })}
          {matching.length > MAX_SHOWN && (
            <div className="px-3 py-2 text-[11px] text-muted">
              showing the top {MAX_SHOWN} of {matching.length.toLocaleString()} patterns; narrow them with the filter box or the timeline
            </div>
          )}
        </div>
      )}
    </div>
  )
}
