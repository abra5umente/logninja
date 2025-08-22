import React, { useEffect, useMemo, useRef, useState } from 'react'
import FileDropZone from './components/FileDropZone'
import SearchBar from './components/SearchBar'
import LevelFilters from './components/LevelFilters'
import VirtualTable from './components/VirtualTable'
import { parseLog } from './lib/parse'
import { FiltersState, LogEntry, LogLevel } from './lib/types'
import TimelinePanel from './components/TimelinePanel'
import PresetsDropdown from './components/PresetsDropdown'
import { buildSearchRegex } from './lib/search'
import ExportBar from './components/ExportBar'
import CommandPalette, { CommandItem } from './components/CommandPalette'
import { rowsToCSV } from './lib/export'
import { AIRLOCK_FIELDS, extractAirlockSummary, isAirlockDebugFileName } from './lib/airlockSummary'
import AirlockSummary from './components/AirlockSummary'
import SettingsSidebar from './components/SettingsSidebar'
import { applyTheme, saveTheme, applyAccent, saveAccent, getInitialTheme, getInitialAccent } from './lib/theme'
import BrandingBanner from './components/BrandingBanner'

export default function App() {
  const [fileName, setFileName] = useState<string>('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filters, setFilters] = useState<FiltersState>({
    selectedLevel: null,
    query: '',
    useRegex: false,
    timeRange: null,
    highlightOnly: false,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [accent, setAccent] = useState('#9CAF88')
  const [binMs, setBinMs] = useState<number>(60000)
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
  const highlightRe = compiledRe

  const filtered = useMemo(() => {
    const re = highlightRe
    let q = filters.query.trim()
    if (q && !filters.useRegex) q = q.toLowerCase()
    
    // If highlightOnly is enabled, don't filter by search query
    if (filters.highlightOnly) {
      return entries.filter(e => {
        if (filters.selectedLevel && e.level !== filters.selectedLevel) return false
        if (filters.timeRange && e.time) {
          const t = e.time.getTime()
          if (t < filters.timeRange.start.getTime() || t >= filters.timeRange.end.getTime()) return false
        } else if (filters.timeRange && !e.time) {
          // exclude entries without timestamp when a time filter is active
          return false
        }
        return true
      })
    }
    
    // Normal filtering mode
    return entries.filter(e => {
      if (filters.selectedLevel && e.level !== filters.selectedLevel) return false
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

  const selectLevel = (lvl: Exclude<LogLevel, 'UNKNOWN'> | null) => {
    setFilters(f => ({ ...f, selectedLevel: lvl }))
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
  
  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    applyAccent(accent)
    saveAccent(accent)
  }, [accent])

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
      selectedLevel: null,
      query: '',
      useRegex: false,
      timeRange: null,
      highlightOnly: false,
    })
  }

  const commands: CommandItem[] = [
    { id: 'toggle-highlight', label: filters.highlightOnly ? 'Disable Highlight Only' : 'Enable Highlight Only', run: () => setFilters(f => ({ ...f, highlightOnly: !f.highlightOnly })) },
    { id: 'clear-filters', label: 'Clear Filters', run: runClearFilters },
    { id: 'export-csv', label: 'Export CSV (filtered)', run: runDownloadCsv },
    { id: 'copy-csv', label: 'Copy CSV (filtered)', run: runCopyCsv },
    { id: 'focus-search', label: 'Focus Search (/)', run: () => searchInputRef.current?.focus() },
  ]

  return (
    <>
      <BrandingBanner />
      <div className="relative z-10 max-w-[1400px] mx-auto p-4">
        <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
          </div>
          <div className="flex items-center gap-2">
            {fileName && <span className="text-xs text-gray-500">Loaded: {fileName}</span>}
            <button
              type="button"
              className="ml-2 p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
              style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
              onMouseEnter={(e) => {
                const target = e.currentTarget;
                const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
                target.style.backgroundColor = accentColor;
                target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.backgroundColor = '';
                target.style.color = '';
              }}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.205 1.251l-1.18 2.044a1 1 0 01-1.186.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.331 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.205-1.251l1.18-2.044a1 1 0 011.186-.447l1.598.54A6.993 6.993 0 017.509 3.456l.331-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="mb-4">
          <FileDropZone onText={onText} />
        </div>

        <div className="mb-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <LevelFilters selectedLevel={filters.selectedLevel} onSelect={selectLevel} />
          <div className="flex items-center gap-3">
            <PresetsDropdown onSelect={(pattern) => setFilters(f => ({ ...f, query: pattern, useRegex: true }))} />
            <SearchBar
              query={filters.query}
              setQuery={(q) => setFilters(f => ({ ...f, query: q }))}
              useRegex={filters.useRegex}
              setUseRegex={(b) => setFilters(f => ({ ...f, useRegex: b }))}
              highlightOnly={filters.highlightOnly}
              setHighlightOnly={(b) => setFilters(f => ({ ...f, highlightOnly: b }))}
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
        <SettingsSidebar
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          theme={theme}
          setTheme={setTheme}
          accent={accent}
          setAccent={setAccent}
        />
      </div>
    </>
  )
}
