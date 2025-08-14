import React, { useEffect, useMemo, useRef, useState } from 'react'
import FileDropZone from './components/FileDropZone'
import SearchBar from './components/SearchBar'
import LevelFilters from './components/LevelFilters'
import VirtualTable from './components/VirtualTable'
import { parseLog } from './lib/parse'
import { FiltersState, LogEntry } from './lib/types'
import TimelinePanel from './components/TimelinePanel'
import PresetsDropdown from './components/PresetsDropdown'
import { buildSearchRegex } from './lib/search'
import ExportBar from './components/ExportBar'
import CommandPalette, { CommandItem } from './components/CommandPalette'
import { rowsToCSV } from './lib/export'
import { AIRLOCK_FIELDS, extractAirlockSummary, isAirlockDebugFileName } from './lib/airlockSummary'
import AirlockSummary from './components/AirlockSummary'

export default function App() {
  const [fileName, setFileName] = useState<string>('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filters, setFilters] = useState<FiltersState>({
    levels: new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']),
    query: '',
    useRegex: false,
    timeRange: null,
  })
  const [binMs, setBinMs] = useState<number>(60000)
  const [highlightEnabled, setHighlightEnabled] = useState<boolean>(true)
  const [cmdOpen, setCmdOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [airlockSummary, setAirlockSummary] = useState<Record<(typeof AIRLOCK_FIELDS)[number], string> | null>(null)
  const [airlockCollapsed, setAirlockCollapsed] = useState(false)
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set())
  const bookmarkedRows = useMemo(() => entries.filter(e => bookmarked.has(e.index)), [entries, bookmarked])
  const toggleBookmark = (idx: number) => setBookmarked(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const onText = (text: string, name: string) => {
    setFileName(name)
    // Airlock Debug Summary: detect by filename and print a two-column table to console.
    try {
      if (isAirlockDebugFileName(name)) {
        const summary = extractAirlockSummary(text)
        setAirlockSummary(summary)
      } else {
        setAirlockSummary(null)
      }
    } catch {
      // Do not crash on errors; continue normal processing.
    }
    const parsed = parseLog(text)
    setEntries(parsed)
  }

  const { re: compiledRe } = useMemo(() => buildSearchRegex(filters.query, filters.useRegex), [filters.query, filters.useRegex])
  const highlightRe = highlightEnabled ? compiledRe : null

  const filtered = useMemo(() => {
    const activeLevels = filters.levels
    const re = highlightRe
    let q = filters.query.trim()
    if (q && !filters.useRegex) q = q.toLowerCase()
    return entries.filter(e => {
      if (!activeLevels.has(e.level as any)) return false
      if (filters.timeRange && e.time) {
        const t = e.time.getTime()
        if (t < filters.timeRange.start.getTime() || t >= filters.timeRange.end.getTime()) return false
      } else if (filters.timeRange && !e.time) {
        // exclude entries without timestamp when a time filter is active
        return false
      }
      if (!q) return true
      const hay = `${e.timeStr} ${e.level} ${e.message}`
      if (re) {
        const flags = re.flags.replace('g', '')
        const testRe = new RegExp(re.source, flags)
        return testRe.test(hay)
      }
      return hay.toLowerCase().includes(q)
    })
  }, [entries, filters, highlightRe])

  // Removed sample log loader

  const toggleLevel = (lvl: any) => {
    setFilters(f => {
      const next = new Set(f.levels)
      if (next.has(lvl)) next.delete(lvl); else next.add(lvl)
      return { ...f, levels: next }
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (!isTyping && e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(true)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const runDownloadCsv = () => {
    const csv = rowsToCSV(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'logs.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const runCopyCsv = async () => {
    const csv = rowsToCSV(filtered)
    try { await navigator.clipboard.writeText(csv) } catch {}
  }

  const runClearFilters = () => {
    setFilters({
      levels: new Set(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']),
      query: '',
      useRegex: false,
      timeRange: null,
    })
  }

  const commands: CommandItem[] = [
    { id: 'toggle-highlight', label: highlightEnabled ? 'Disable Highlight' : 'Enable Highlight', run: () => setHighlightEnabled(h => !h) },
    { id: 'clear-filters', label: 'Clear Filters', run: runClearFilters },
    { id: 'export-csv', label: 'Export CSV (filtered)', run: runDownloadCsv },
    { id: 'copy-csv', label: 'Copy CSV (filtered)', run: runCopyCsv },
    { id: 'focus-search', label: 'Focus Search (/)', run: () => searchInputRef.current?.focus() },
  ]

  return (
    <div className="max-w-[1400px] mx-auto p-4">
      <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Log Slicer</h1>
          <p className="text-sm text-gray-600">Client-side log viewer with search and filters</p>
        </div>
        <div className="flex items-center gap-2">
          {fileName && <span className="text-xs text-gray-500">Loaded: {fileName}</span>}
        </div>
      </header>

      <div className="mb-4">
        <FileDropZone onText={onText} />
      </div>

      <div className="mb-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <LevelFilters active={filters.levels} onToggle={toggleLevel} />
        <div className="flex items-center gap-3">
          <PresetsDropdown onSelect={(pattern) => setFilters(f => ({ ...f, query: pattern, useRegex: true }))} />
          <SearchBar
            query={filters.query}
            setQuery={(q) => setFilters(f => ({ ...f, query: q }))}
            useRegex={filters.useRegex}
            setUseRegex={(b) => setFilters(f => ({ ...f, useRegex: b }))}
            ref={searchInputRef}
          />
        </div>
      </div>

      {airlockSummary && (
        <div className="mb-3">
          <AirlockSummary
            data={airlockSummary}
            collapsed={airlockCollapsed}
            setCollapsed={setAirlockCollapsed}
            onFilterText={(text, useRegex = false) => setFilters(f => ({ ...f, query: text, useRegex }))}
          />
        </div>
      )}

      <div className="mb-3">
        <ExportBar rows={filtered} filters={filters} bookmarked={bookmarkedRows} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px] gap-4">
        <VirtualTable rows={filtered} height={560} highlightRe={highlightRe} bookmarked={bookmarked} onToggleBookmark={toggleBookmark} selectedIndex={selectedIndex} onSelectRow={setSelectedIndex} />
        <TimelinePanel
          entries={entries}
          binMs={binMs}
          setBinMs={setBinMs}
          onSelectRange={(r) => setFilters(f => ({ ...f, timeRange: r }))}
          activeRange={filters.timeRange ?? null}
        />
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={commands} />
    </div>
  )
}
