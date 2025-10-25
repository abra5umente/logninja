import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import LoadingOverlay from './components/LoadingOverlay'
import { applyTheme, saveTheme, applyAccent, saveAccent, getInitialTheme, getInitialAccent } from './lib/theme'

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
    selectedLevel: null,  // Deprecated
    selectedLevels: null,
    selectedFiles: null,
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
  const [airlockModalOpen, setAirlockModalOpen] = useState(false)
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set())
  const [loadTime, setLoadTime] = useState<number>(0)
  const [showLoadBanner, setShowLoadBanner] = useState(false)
  const bookmarkedRows = useMemo(() => entries.filter(e => bookmarked.has(e.index)), [entries, bookmarked])
  const toggleBookmark = (idx: number) => setBookmarked(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n })
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadingStage, setLoadingStage] = useState<'idle' | 'loading' | 'complete'>('idle')
  const [loadingFileCount, setLoadingFileCount] = useState(0)

  // Auto-disable bookmark mode when all bookmarks are removed
  useEffect(() => {
    if (bookmarked.size === 0 && filters.showBookmarksOnly) {
      setFilters(f => ({ ...f, showBookmarksOnly: false }))
    }
  }, [bookmarked.size, filters.showBookmarksOnly])

  // ESC key to close Airlock modal
  useEffect(() => {
    if (!airlockModalOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAirlockModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [airlockModalOpen])

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
          setAirlockModalOpen(true) // Auto-open modal when Airlock file is loaded
        } else if (prev.length === 0) {
          // Only clear airlock summary if this is the first file
          setAirlockSummary(null)
          setAirlockModalOpen(false)
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

  const handleFileClick = (fileId: string, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Ctrl+click: toggle file in multi-selection
      setFilters(f => {
        const current = f.selectedFiles || []
        const isSelected = current.includes(fileId)
        const newSelection = isSelected
          ? current.filter(id => id !== fileId)
          : [...current, fileId]
        return {
          ...f,
          selectedFiles: newSelection.length > 0 ? newSelection : null
        }
      })
    } else {
      // Regular click: toggle selection if already the only selected file
      setFilters(f => {
        const current = f.selectedFiles || []
        const isSingleSelected = current.length === 1 && current[0] === fileId

        return {
          ...f,
          selectedFiles: isSingleSelected ? null : [fileId]
        }
      })
    }
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
        // File filter
        if (filters.selectedFiles && filters.selectedFiles.length > 0 && e.fileId) {
          if (!filters.selectedFiles.includes(e.fileId)) return false
        }
        // Level filter (use new selectedLevels or fall back to deprecated selectedLevel)
        if (filters.selectedLevels && filters.selectedLevels.length > 0) {
          if (!filters.selectedLevels.includes(e.level)) return false
        } else if (filters.selectedLevel && e.level !== filters.selectedLevel) {
          return false
        }
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
      // File filter
      if (filters.selectedFiles && filters.selectedFiles.length > 0 && e.fileId) {
        if (!filters.selectedFiles.includes(e.fileId)) return false
      }
      // Level filter (use new selectedLevels or fall back to deprecated selectedLevel)
      if (filters.selectedLevels && filters.selectedLevels.length > 0) {
        if (!filters.selectedLevels.includes(e.level)) return false
      } else if (filters.selectedLevel && e.level !== filters.selectedLevel) {
        return false
      }
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

  const handleLevelClick = (level: LogLevel, isCtrlClick: boolean) => {
    if (isCtrlClick) {
      // Ctrl+click: toggle level in multi-selection
      setFilters(f => {
        const current = f.selectedLevels || []
        const isSelected = current.includes(level)
        const newSelection = isSelected
          ? current.filter(l => l !== level)
          : [...current, level]
        return {
          ...f,
          selectedLevels: newSelection.length > 0 ? newSelection : null,
          selectedLevel: null  // Clear deprecated field when using multi-select
        }
      })
    } else {
      // Regular click: select only this level
      setFilters(f => ({
        ...f,
        selectedLevels: [level],
        selectedLevel: null  // Clear deprecated field
      }))
    }
  }

  // Calculate available levels from loaded files (or filtered files if file filter is active)
  const availableLevels = useMemo(() => {
    const levelsSet = new Set<LogLevel>()
    const entriesToCheck = filters.selectedFiles && filters.selectedFiles.length > 0
      ? entries.filter(e => e.fileId && filters.selectedFiles!.includes(e.fileId))
      : entries
    entriesToCheck.forEach(e => levelsSet.add(e.level))
    return Array.from(levelsSet)
  }, [entries, filters.selectedFiles])

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
      selectedLevels: null,
      selectedFiles: null,
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
      {/* Loading Overlay */}
      <LoadingOverlay
        stage={loadingStage}
        fileCount={loadingFileCount}
        onComplete={() => setLoadingStage('idle')}
      />

      {showLoadBanner && (
        <LoadBanner
          fileName={loadedFiles.length > 0 ? `${loadedFiles.length} file${loadedFiles.length > 1 ? 's' : ''}` : ''}
          loadTime={loadTime}
          entriesCount={entries.length}
          onClose={() => setShowLoadBanner(false)}
        />
      )}

      {/* Settings Button - Bottom Right */}
      <button
        type="button"
        className="fixed right-4 bottom-4 z-20 p-3 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors shadow-lg"
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
        onClick={() => setSettingsOpen(prev => !prev)}
        aria-label="Toggle settings"
        title="Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-6 h-6"
        >
          <path
            fillRule="evenodd"
            d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.205 1.251l-1.18 2.044a1 1 0 01-1.186.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.331 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.205-1.251l1.18-2.044a1 1 0 011.186-.447l1.598.54A6.993 6.993 0 017.509 3.456l.331-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        className="relative z-10 w-full h-screen overflow-hidden flex flex-col p-4"
        onDragOver={(e) => { e.preventDefault(); setIsDraggingGlobal(true) }}
        onDragLeave={(e) => {
          // Only set false if leaving the main container
          if (e.currentTarget === e.target) {
            setIsDraggingGlobal(false)
          }
        }}
        onDrop={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDraggingGlobal(false)

          const files = Array.from(e.dataTransfer.files).filter(f => /(\.log|\.txt|\.csv)$/i.test(f.name))
          if (files.length === 0) return

          // Start loading animation
          setLoadingStage('loading')
          setLoadingFileCount(files.length)

          // Process files
          for (const file of files) {
            try {
              const text = await file.text()
              onText(text, file.name)
            } catch (err) {
              console.error(`Failed to read ${file.name}:`, err)
            }
          }

          // Files loaded, show complete animation
          setLoadingStage('complete')
        }}
      >
        {/* Global Drop Overlay */}
        {isDraggingGlobal && (
          <div className="fixed inset-0 z-50 bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center backdrop-blur-sm pointer-events-none">
            <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg p-8 shadow-2xl">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">Drop log files here</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Supported: .log, .txt, .csv</div>
            </div>
          </div>
        )}

        {/* Hidden file input for browse button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt,.csv"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files
            if (!files || files.length === 0) return

            // Start loading animation
            setLoadingStage('loading')
            setLoadingFileCount(files.length)

            // Process files
            for (let i = 0; i < files.length; i++) {
              const file = files[i]
              try {
                const text = await file.text()
                onText(text, file.name)
              } catch (err) {
                console.error(`Failed to read ${file.name}:`, err)
              }
            }

            // Files loaded, show complete animation
            setLoadingStage('complete')

            e.target.value = ''
          }}
        />

        {/* Three-column grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="flex flex-col gap-3 overflow-y-auto"  style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Level Filters */}
            {entries.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Log Levels</div>
                <LevelFilters
                  selectedLevels={filters.selectedLevels}
                  availableLevels={availableLevels}
                  onLevelClick={handleLevelClick}
                />
              </div>
            )}

            {/* Log Summary */}
            {entries.length > 0 && (
              <LogSummary
                entries={entries}
                fileName={loadedFiles.length > 0 ? loadedFiles.map(f => f.name).join(', ') : ''}
                loadTime={loadTime}
              />
            )}

            {/* Export Controls */}
            {entries.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Export & Actions</div>
                <ExportBar rows={filtered} filters={filters} bookmarked={bookmarkedRows} resetFilters={runClearFilters} />
              </div>
            )}

            {/* Airlock Summary Button */}
            {airlockSummary && (
              <button
                className="px-2 py-1.5 text-xs bg-[var(--accent)] text-white rounded transition-colors hover:brightness-90"
                onClick={() => setAirlockModalOpen(prev => !prev)}
              >
                {airlockModalOpen ? 'Hide' : 'View'} Airlock Summary
              </button>
            )}
          </aside>

          {/* Center - Main Content */}
          <main className="flex flex-col gap-3 overflow-hidden"  style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Virtual Table */}
            <div className="flex-1 min-h-0 relative">
              <VirtualTable rows={filtered} height={undefined} highlightRe={highlightRe} bookmarked={bookmarked} onToggleBookmark={toggleBookmark} selectedIndex={selectedIndex} onSelectRow={setSelectedIndex} loadedFiles={loadedFiles} />

              {/* Empty State Overlay */}
              {entries.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm z-10 pointer-events-none">
                  <div className="text-center">
                    <div
                      className="text-5xl font-bold tracking-wide mb-4"
                      style={{
                        color: 'var(--accent)',
                        fontFamily: 'monospace'
                      }}
                    >
                      logninja.
                    </div>
                    <div className="text-xl text-gray-600 dark:text-gray-300 mb-2">Drag & drop log files anywhere</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">or</div>
                    <button
                      className="px-4 py-2 text-sm text-white rounded transition-colors bg-[var(--accent)] hover:brightness-90 pointer-events-auto"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files...
                    </button>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">Supported: .log, .txt, .csv</div>
                  </div>
                </div>
              )}
            </div>

            {/* Bookmark Controls (shown below table when bookmarks exist) */}
            {bookmarked.size > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-3">
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
              </div>
            )}

            {/* Timeline - Horizontal */}
            {entries.length > 0 && (
              <TimelinePanel
                entries={entries}
                binMs={binMs}
                setBinMs={setBinMs}
                onSelectRange={(r) => setFilters(f => ({ ...f, timeRange: r }))}
                activeRange={filters.timeRange ?? null}
              />
            )}
          </main>

          {/* Right Sidebar */}
          <aside className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Search Bar */}
            {entries.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Search</div>
                <div className="flex flex-col gap-2">
                  <SearchBar
                    query={filters.query}
                    setQuery={(q) => setFilters(f => ({ ...f, query: q }))}
                    useRegex={filters.useRegex}
                    setUseRegex={(b) => setFilters(f => ({ ...f, useRegex: b }))}
                    highlightOnly={filters.highlightOnly}
                    setHighlightOnly={(b) => setFilters(f => ({ ...f, highlightOnly: b }))}
                    ref={searchInputRef}
                  />
                  <PresetsDropdown onSelect={(pattern) => setFilters(f => ({ ...f, query: pattern, useRegex: true }))} />
                </div>
              </div>
            )}

            {/* Loaded Files */}
            {loadedFiles.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-800">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Loaded Files ({loadedFiles.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {loadedFiles.map(file => {
                    const isSelected = filters.selectedFiles?.includes(file.id) ?? false
                    const hasSelection = (filters.selectedFiles?.length ?? 0) > 0
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs text-white cursor-pointer transition-opacity"
                        style={{
                          backgroundColor: file.color,
                          opacity: hasSelection ? (isSelected ? 1 : 0.4) : 1
                        }}
                        onClick={(e) => handleFileClick(file.id, e.ctrlKey || e.metaKey)}
                        title="Click to filter to this file only. Ctrl+click to select multiple files."
                      >
                        <div className="flex-1 truncate pointer-events-none">
                          <div className="font-medium">{file.name}</div>
                          <div className="opacity-80">{file.entryCount.toLocaleString()} entries</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(file.id)
                          }}
                          className="hover:opacity-75 text-lg leading-none pointer-events-auto"
                          aria-label={`Remove ${file.name}`}
                          title="Remove file"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Airlock Summary Modal */}
        {airlockSummary && airlockModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={(e) => {
              // Close if clicking the backdrop
              if (e.target === e.currentTarget) {
                setAirlockModalOpen(false)
              }
            }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-md shadow-xl w-[min(90vw,1000px)] max-h-[90vh] flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="font-semibold text-gray-800 dark:text-gray-100">Airlock Debug Summary</div>
                <button
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors hover:bg-[var(--accent)] hover:text-white"
                  onClick={() => setAirlockModalOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="overflow-auto p-4">
                <AirlockSummary
                  data={airlockSummary}
                  collapsed={false}
                  setCollapsed={() => {}}
                  onFilterText={(text, useRegex = false) => {
                    setFilters(f => ({ ...f, query: text, useRegex }))
                    setAirlockModalOpen(false)
                  }}
                />
              </div>
            </div>
          </div>
        )}

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
