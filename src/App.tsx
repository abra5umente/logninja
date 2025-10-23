import React, { useEffect, useMemo, useRef, useState } from 'react'
import FileDropZone from './components/FileDropZone'
import SearchBar from './components/SearchBar'
import LevelFilters from './components/LevelFilters'
import VirtualTable from './components/VirtualTable'
import { parseLog } from './lib/parse'
import { FiltersState, LogEntry, LogLevel, FileInfo } from './lib/types'
import TimelinePanel from './components/TimelinePanel'
import PresetsDropdown from './components/PresetsDropdown'
import { buildSearchRegex } from './lib/search'
import ExportBar from './components/ExportBar'
import CommandPalette, { CommandItem } from './components/CommandPalette'
import { rowsToCSV } from './lib/export'
import { AIRLOCK_FIELDS, extractAirlockSummary, isAirlockDebugFileName } from './lib/airlockSummary'
import AirlockSummary from './components/AirlockSummary'
import LogSummary from './components/LogSummary'
import LoadBanner from './components/LoadBanner'
import SettingsSidebar from './components/SettingsSidebar'
import { applyTheme, saveTheme, applyAccent, saveAccent, getInitialTheme, getInitialAccent } from './lib/theme'
import BrandingBanner from './components/BrandingBanner'

// Color palette for different log files
// Note: Supports up to 10 distinct files; colors repeat after that
const FILE_COLORS = [
  '#9CAF88', '#88AFCA', '#CA88AF', '#AFCA88', '#CA9C88',
  '#88CA9C', '#9C88CA', '#CAA888', '#88CAA8', '#A888CA'
]

export default function App() {
  const [loadedFiles, setLoadedFiles] = useState<FileInfo[]>([])
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filters, setFilters] = useState<FiltersState>({
    selectedLevel: null,
    query: '',
    useRegex: false,
    timeRange: null,
    highlightOnly: false,
    showBookmarksOnly: false,
    bookmarkContext: 3,
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
  const [loadTime, setLoadTime] = useState<number>(0)
  const [showLoadBanner, setShowLoadBanner] = useState(false)
  const bookmarkedRows = useMemo(() => entries.filter(e => bookmarked.has(e.index)), [entries, bookmarked])
  const toggleBookmark = (idx: number) => setBookmarked(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // Auto-disable bookmark mode when all bookmarks are removed
  useEffect(() => {
    if (bookmarked.size === 0 && filters.showBookmarksOnly) {
      setFilters(f => ({ ...f, showBookmarksOnly: false }))
    }
  }, [bookmarked.size, filters.showBookmarksOnly])

  const onText = (text: string, name: string) => {
    const startTime = performance.now()

    // Generate unique file ID
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Use functional updates to avoid stale closure issues with batched state updates
    setLoadedFiles(prev => {
      const fileColor = FILE_COLORS[prev.length % FILE_COLORS.length]

      // Airlock Debug Summary: detect by filename and print a two-column table to console.
      try {
        if (isAirlockDebugFileName(name)) {
          const summary = extractAirlockSummary(text)
          setAirlockSummary(summary)
        } else if (prev.length === 0) {
          // Only clear airlock summary if this is the first file
          setAirlockSummary(null)
        }
      } catch {
        // Do not crash on errors; continue normal processing.
      }

      // Parse the log with file information (now using the correct color)
      const parsed = parseLog(text, fileId, name)

      // Update entries using functional update to get latest state
      setEntries(prevEntries => {
        // Merge with existing entries and sort by timestamp
        const mergedEntries = [...prevEntries, ...parsed].sort((a, b) => {
          // Sort by timestamp, putting null timestamps at the end
          if (a.time === null && b.time === null) return 0
          if (a.time === null) return 1
          if (b.time === null) return -1
          return a.time.getTime() - b.time.getTime()
        })

        // Re-index all entries after merging
        return mergedEntries.map((entry, idx) => ({ ...entry, index: idx }))
      })

      const newFileInfo: FileInfo = {
        id: fileId,
        name,
        color: fileColor,
        entryCount: parsed.length
      }

      return [...prev, newFileInfo]
    })

    const endTime = performance.now()
    setLoadTime(endTime - startTime)
    setShowLoadBanner(true)
  }

  const removeFile = (fileId: string) => {
    // Remove file from loaded files
    setLoadedFiles(prev => prev.filter(f => f.id !== fileId))

    // Remove entries from this file and update bookmarks - use functional updates
    setEntries(prevEntries => {
      // Get indices to remove before filtering
      const removedIndices = prevEntries.filter(e => e.fileId === fileId).map(e => e.index)

      // Clear bookmarks for removed entries
      setBookmarked(prevBookmarks => {
        const updated = new Set(prevBookmarks)
        removedIndices.forEach(idx => updated.delete(idx))
        return updated
      })

      // Remove entries from this file
      const filteredEntries = prevEntries.filter(e => e.fileId !== fileId)

      // Re-index remaining entries
      return filteredEntries.map((entry, idx) => ({ ...entry, index: idx }))
    })
  }

  const { re: compiledRe } = useMemo(() => buildSearchRegex(filters.query, filters.useRegex), [filters.query, filters.useRegex])
  const highlightRe = compiledRe

  const filtered = useMemo(() => {
    // Bookmark-only mode: show bookmarks with context
    if (filters.showBookmarksOnly) {
      if (bookmarked.size === 0) return []

      const indicesToInclude = new Set<number>()

      // For each bookmarked entry, add it and context lines
      bookmarked.forEach(bookmarkIndex => {
        // Find the actual array position of this bookmarked entry
        const arrayPosition = entries.findIndex(e => e.index === bookmarkIndex)
        if (arrayPosition < 0) return // Bookmark no longer exists

        const contextStart = Math.max(0, arrayPosition - filters.bookmarkContext)
        const contextEnd = Math.min(entries.length - 1, arrayPosition + filters.bookmarkContext)

        for (let i = contextStart; i <= contextEnd; i++) {
          // Add the actual entry index, not the array position
          indicesToInclude.add(entries[i].index)
        }
      })

      // Filter to only included indices (maintains chronological order)
      return entries.filter(e => indicesToInclude.has(e.index))
    }

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
  }, [entries, filters, highlightRe, bookmarked])

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
      showBookmarksOnly: false,
      bookmarkContext: 3,
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
      {showLoadBanner && (
        <LoadBanner
          fileName={loadedFiles.length > 0 ? `${loadedFiles.length} file${loadedFiles.length > 1 ? 's' : ''}` : ''}
          loadTime={loadTime}
          entriesCount={entries.length}
          onClose={() => setShowLoadBanner(false)}
        />
      )}
      <div className="relative z-10 max-w-[1400px] mx-auto p-4">
        <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {loadedFiles.length > 0 && (
              <>
                <span className="text-xs text-gray-500">Loaded files ({loadedFiles.length}):</span>
                {loadedFiles.map(file => (
                  <div
                    key={file.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-white"
                    style={{ backgroundColor: file.color }}
                  >
                    <span>{file.name} ({file.entryCount.toLocaleString()})</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="ml-1 hover:opacity-75"
                      aria-label={`Remove ${file.name}`}
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
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
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <LevelFilters selectedLevel={filters.selectedLevel} onSelect={selectLevel} />

            {bookmarked.size > 0 && (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
                  <input
                    type="checkbox"
                    checked={filters.showBookmarksOnly}
                    onChange={(e) => setFilters(f => ({ ...f, showBookmarksOnly: e.target.checked }))}
                  />
                  Show bookmarks only ({bookmarked.size})
                </label>

                {filters.showBookmarksOnly && (
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Context:</label>
                    <select
                      value={filters.bookmarkContext}
                      onChange={(e) => setFilters(f => ({ ...f, bookmarkContext: parseInt(e.target.value, 10) }))}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="1">±1 line</option>
                      <option value="3">±3 lines</option>
                      <option value="5">±5 lines</option>
                      <option value="10">±10 lines</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

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

        {entries.length > 0 && (
          <div className="mb-3">
            <LogSummary
              entries={entries}
              fileName={loadedFiles.length > 0 ? loadedFiles.map(f => f.name).join(', ') : ''}
              loadTime={loadTime}
            />
          </div>
        )}

        <div className="mb-3">
          <ExportBar rows={filtered} filters={filters} bookmarked={bookmarkedRows} resetFilters={runClearFilters} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_380px] gap-4">
          <VirtualTable rows={filtered} height={560} highlightRe={highlightRe} bookmarked={bookmarked} onToggleBookmark={toggleBookmark} selectedIndex={selectedIndex} onSelectRow={setSelectedIndex} loadedFiles={loadedFiles} />
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
