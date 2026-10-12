import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SearchBar from './components/SearchBar'
import LevelFilters from './components/LevelFilters'
import VirtualTable from './components/VirtualTable'
import { parseLog } from './lib/parse'
import { FiltersState, LogEntry, LogLevel, FileInfo, entryKey } from './lib/types'
import { readLogFile } from './lib/decode'
import { passesBaseFilters, withBookmarkContext } from './lib/filter'
import TimelinePanel from './components/TimelinePanel'
import PatternsPanel from './components/PatternsPanel'
import ViewSwitch, { CenterView } from './components/ViewSwitch'
import PresetsDropdown from './components/PresetsDropdown'
import { buildSearchRegex } from './lib/search'
import { nextLevelSelection } from './lib/levelSelection'
import ExportBar from './components/ExportBar'
import CommandPalette, { CommandItem } from './components/CommandPalette'
import { rowsToCSV } from './lib/export'
import { AIRLOCK_FIELDS, extractAirlockSummary, isAirlockDebugFileName } from './lib/airlockSummary'
import AirlockSummary from './components/AirlockSummary'
import LogSummary from './components/LogSummary'
import LoadBanner from './components/LoadBanner'
import SkippedNotice from './components/SkippedNotice'
import SettingsSidebar from './components/SettingsSidebar'
import LoadingOverlay from './components/LoadingOverlay'
import GroupHeading from './components/GroupHeading'
import WhatsNewModal from './components/WhatsNewModal'
import { WHATS_NEW, WhatsNewRelease, getSeenId, markSeen, unseenRelease } from './lib/whatsNew'
import { applyTheme, getInitialPalette, getInitialSchemePref, resolveScheme, savePalette, saveSchemePref, systemPrefersLight, watchSystemScheme, Palette, SchemePref, PALETTES, PALETTE_LABELS } from './lib/theme'

// Colours for different log files, from the theme's named colours so they follow the palette.
// Green, yellow and red are left out because they mean ok / warning / error.
// Note: Supports up to 6 distinct files; colors repeat after that
const FILE_COLORS = [
  'var(--accent)', 'var(--magenta)', 'var(--cyan)',
  'color-mix(in srgb, var(--accent) 55%, var(--bg))',
  'color-mix(in srgb, var(--magenta) 55%, var(--bg))',
  'color-mix(in srgb, var(--cyan) 55%, var(--bg))',
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
    searchMode: 'find',  // Default to find mode (jump to matches)
    currentMatchIndex: 0,
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [palette, setPalette] = useState<Palette>(getInitialPalette)
  const [schemePref, setSchemePref] = useState<SchemePref>(getInitialSchemePref)
  const [systemLight, setSystemLight] = useState(systemPrefersLight)
  const [armedFileId, setArmedFileId] = useState<string | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  // Shows once per new release; reopened from settings or the command palette
  const [whatsNew, setWhatsNew] = useState<WhatsNewRelease | null>(() => unseenRelease(WHATS_NEW, getSeenId()))
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [airlockSummary, setAirlockSummary] = useState<Record<(typeof AIRLOCK_FIELDS)[number], string> | null>(null)
  const [airlockModalOpen, setAirlockModalOpen] = useState(false)
  // The file the Airlock summary came from, so removing it clears the summary
  const [airlockFileId, setAirlockFileId] = useState<string | null>(null)
  // Bookmarks are keyed by entryKey (file + line), not index, so they stay on their line when files come and go
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set())
  const [loadTime, setLoadTime] = useState<number>(0)
  const [showLoadBanner, setShowLoadBanner] = useState(false)
  const bookmarkedRows = useMemo(() => entries.filter(e => bookmarked.has(entryKey(e))), [entries, bookmarked])
  const toggleBookmark = (key: string) => setBookmarked(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
  // The selected row, by entryKey so it stays put when files come and go
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [centerView, setCenterView] = useState<CenterView>('rows')
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadingStage, setLoadingStage] = useState<'idle' | 'loading' | 'complete'>('idle')
  const [loadingFileCount, setLoadingFileCount] = useState(0)
  // Files the last load skipped because they weren't text
  const [skippedFiles, setSkippedFiles] = useState<string[]>([])

  // Refs and state for dynamic height calculation
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [tableHeight, setTableHeight] = useState<number>(600) // Default fallback

  // Auto-disable bookmark mode when all bookmarks are removed
  useEffect(() => {
    if (bookmarked.size === 0 && filters.showBookmarksOnly) {
      setFilters(f => ({ ...f, showBookmarksOnly: false }))
    }
  }, [bookmarked.size, filters.showBookmarksOnly])

  // Remember the release as soon as it shows, so it never pops up twice
  useEffect(() => {
    if (whatsNew) markSeen(whatsNew.id)
  }, [whatsNew])
  const closeWhatsNew = useCallback(() => setWhatsNew(null), [])
  const openWhatsNew = useCallback(() => {
    setSettingsOpen(false)
    setWhatsNew(WHATS_NEW[0] ?? null)
  }, [])

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

  // Size the VirtualTable to the space its wrapper gets from the centre column's flex layout.
  // The wrapper is flex-1 + min-h-0, so its height comes from the viewport and the timeline,
  // never from the table's own content, which keeps this from feeding back into itself.
  useEffect(() => {
    const el = tableWrapRef.current
    if (!el) return
    const calculateHeight = () => setTableHeight(Math.max(Math.floor(el.getBoundingClientRect().height), 160))
    calculateHeight()
    const resizeObserver = new ResizeObserver(calculateHeight)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [])

  const onText = (text: string, name: string) => {
    const startTime = performance.now()

    // Generate unique file ID
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Parse here rather than inside a state updater, so it runs once and the load time is real
    const parsed = parseLog(text, fileId, name)

    // Airlock Debug Summary: detect by filename and open the summary modal
    if (isAirlockDebugFileName(name)) {
      try {
        setAirlockSummary(extractAirlockSummary(text))
        setAirlockFileId(fileId)
        setAirlockModalOpen(true)
      } catch {
        // Do not crash on errors; continue normal processing.
      }
    }

    // Functional updates, because several files can be loaded before React re-renders
    setLoadedFiles(prev => {
      // First colour no loaded file is using, so removing and re-adding files doesn't double up
      const used = new Set(prev.map(f => f.color))
      const fileColor = FILE_COLORS.find(c => !used.has(c)) ?? FILE_COLORS[prev.length % FILE_COLORS.length]
      return [...prev, { id: fileId, name, color: fileColor, entryCount: parsed.length }]
    })

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

    setLoadTime(performance.now() - startTime)
    setShowLoadBanner(true)
  }

  // Read dropped or browsed files. Any name is accepted (server.log.1, syslog), but archives and other
  // binary files are skipped with a note rather than shown as garbage.
  const loadFiles = async (files: File[]) => {
    if (files.length === 0) return
    setLoadingStage('loading')
    setLoadingFileCount(files.length)
    const skipped: string[] = []
    for (const file of files) {
      try {
        const text = await readLogFile(file)
        if (text === null) skipped.push(file.name)
        else onText(text, file.name)
      } catch (err) {
        console.error(`Failed to read ${file.name}:`, err)
        skipped.push(file.name)
      }
    }
    setSkippedFiles(skipped)
    setLoadingStage('complete')
  }

  const removeFile = (fileId: string) => {
    // Removing the last file starts over, so an old search or time range doesn't hide the next file
    if (loadedFiles.length <= 1) runClearFilters()

    setLoadedFiles(prev => prev.filter(f => f.id !== fileId))

    // Remove entries from this file and re-index the rest
    setEntries(prevEntries => prevEntries.filter(e => e.fileId !== fileId).map((entry, idx) => ({ ...entry, index: idx })))

    // Drop this file's bookmarks
    setBookmarked(prev => new Set([...prev].filter(k => !k.startsWith(`${fileId}:`))))

    // Stop filtering to a file that's gone, or the table would be empty
    setFilters(f => {
      if (!f.selectedFiles) return f
      const rest = f.selectedFiles.filter(id => id !== fileId)
      return { ...f, selectedFiles: rest.length > 0 ? rest : null }
    })

    if (fileId === airlockFileId) {
      setAirlockSummary(null)
      setAirlockFileId(null)
      setAirlockModalOpen(false)
    }
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

  // Search test against `time level message`, built once rather than per row
  const matchesQuery = useMemo(() => {
    const q = filters.query.trim()
    if (!q) return null
    if (highlightRe) {
      const testRe = new RegExp(highlightRe.source, highlightRe.flags.replace('g', ''))
      return (e: LogEntry) => testRe.test(`${e.timeStr} ${e.level} ${e.message}`)
    }
    const needle = q.toLowerCase()
    return (e: LogEntry) => `${e.timeStr} ${e.level} ${e.message}`.toLowerCase().includes(needle)
  }, [filters.query, highlightRe])

  // Rows that pass the file, level and time filters
  const baseFiltered = useMemo(
    () => entries.filter(e => passesBaseFilters(e, filters)),
    [entries, filters.selectedFiles, filters.selectedLevels, filters.selectedLevel, filters.timeRange]
  )

  const filtered = useMemo(() => {
    // Bookmark-only mode: bookmarks with context, within the other filters
    if (filters.showBookmarksOnly) return withBookmarkContext(baseFiltered, bookmarked, filters.bookmarkContext)
    // Find mode and highlight-only show every row and only mark the matches
    if (filters.searchMode === 'find' || filters.highlightOnly || !matchesQuery) return baseFiltered
    return baseFiltered.filter(matchesQuery)
  }, [baseFiltered, bookmarked, filters.showBookmarksOnly, filters.bookmarkContext, filters.searchMode, filters.highlightOnly, matchesQuery])

  // The timeline shows what the table would show without the time range, so picking a range
  // doesn't empty the bars around it. Search hides rows only in filter mode; in find and
  // highlight mode the hits get their own strip instead.
  const timelineEntries = useMemo(() => {
    const noTime = { ...filters, timeRange: null }
    const searchHides = filters.searchMode === 'filter' && !filters.highlightOnly ? matchesQuery : null
    return entries.filter(e => passesBaseFilters(e, noTime) && (!searchHides || searchHides(e)))
  }, [entries, filters.selectedFiles, filters.selectedLevels, filters.selectedLevel, filters.searchMode, filters.highlightOnly, matchesQuery])
  const showTimelineHits = filters.searchMode === 'find' || filters.highlightOnly ? matchesQuery : null

  // Find mode: the rows that match the search, by entryKey
  const matchingKeys = useMemo(() => {
    if (filters.searchMode !== 'find' || !matchesQuery) return []
    return baseFiltered.filter(matchesQuery).map(entryKey)
  }, [baseFiltered, filters.searchMode, matchesQuery])

  // Navigate to next/previous match
  const goToNextMatch = () => {
    if (matchingKeys.length === 0) return
    const nextIndex = (filters.currentMatchIndex + 1) % matchingKeys.length
    setFilters(f => ({ ...f, currentMatchIndex: nextIndex }))
    setSelectedKey(matchingKeys[nextIndex])
  }

  const goToPreviousMatch = () => {
    if (matchingKeys.length === 0) return
    const prevIndex = (filters.currentMatchIndex - 1 + matchingKeys.length) % matchingKeys.length
    setFilters(f => ({ ...f, currentMatchIndex: prevIndex }))
    setSelectedKey(matchingKeys[prevIndex])
  }

  // Auto-jump to first match when query changes in find mode
  useEffect(() => {
    if (filters.searchMode === 'find' && filters.query && matchingKeys.length > 0) {
      setFilters(f => ({ ...f, currentMatchIndex: 0 }))
      setSelectedKey(matchingKeys[0])
    }
  }, [filters.query, filters.searchMode, matchingKeys.length])

  // Removed sample log loader

  const selectLevel = (lvl: Exclude<LogLevel, 'UNKNOWN'> | null) => {
    setFilters(f => ({ ...f, selectedLevel: lvl }))
  }

  const handleLevelClick = (level: LogLevel, isCtrlClick: boolean) => {
    setFilters(f => ({
      ...f,
      selectedLevels: nextLevelSelection(f.selectedLevels, level, isCtrlClick),
      selectedLevel: null  // Clear deprecated field
    }))
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

      // Find mode navigation: Enter = next, Shift+Enter = previous. Only from the search box or with nothing
      // focused, so Enter still works in dialogs and on buttons.
      const fromSearchOrPage = target === searchInputRef.current || target === document.body
      if (filters.searchMode === 'find' && filters.query && matchingKeys.length > 0 && e.key === 'Enter' && fromSearchOrPage) {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousMatch()
        } else {
          goToNextMatch()
        }
        return
      }

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
  }, [filters.searchMode, filters.query, matchingKeys.length, goToNextMatch, goToPreviousMatch])
  
  useEffect(() => watchSystemScheme(() => setSystemLight(systemPrefersLight())), [])

  useEffect(() => {
    applyTheme(palette, resolveScheme(schemePref, systemLight))
    savePalette(palette)
    saveSchemePref(schemePref)
  }, [palette, schemePref, systemLight])

  // Two-click remove: the first click arms the button, which disarms itself after a few seconds
  useEffect(() => {
    if (!armedFileId) return
    const t = setTimeout(() => setArmedFileId(null), 3000)
    return () => clearTimeout(t)
  }, [armedFileId])

  // Stable, so the banner's and overlay's timers aren't restarted by every re-render
  const closeLoadBanner = useCallback(() => setShowLoadBanner(false), [])
  const finishLoading = useCallback(() => setLoadingStage('idle'), [])
  const closeSkippedNotice = useCallback(() => setSkippedFiles([]), [])

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
      searchMode: 'find',
      currentMatchIndex: 0,
    })
  }

  // From the patterns view: filter the table to one pattern's rows via the search box,
  // so the query stays visible and editable.
  const showPatternRows = (regex: string) => {
    setFilters(f => ({ ...f, query: regex, useRegex: true, searchMode: 'filter', highlightOnly: false, currentMatchIndex: 0 }))
    setCenterView('rows')
  }

  const commands: CommandItem[] = [
    { id: 'toggle-patterns', label: centerView === 'patterns' ? 'Show Log Rows' : 'Show Log Patterns', run: () => setCenterView(v => (v === 'patterns' ? 'rows' : 'patterns')) },
    { id: 'toggle-highlight', label: filters.highlightOnly ? 'Disable Highlight Only' : 'Enable Highlight Only', run: () => setFilters(f => ({ ...f, highlightOnly: !f.highlightOnly })) },
    { id: 'clear-filters', label: 'Clear Filters', run: runClearFilters },
    { id: 'export-csv', label: 'Export CSV (filtered)', run: runDownloadCsv },
    { id: 'copy-csv', label: 'Copy CSV (filtered)', run: runCopyCsv },
    { id: 'focus-search', label: 'Focus Search (/)', run: () => searchInputRef.current?.focus() },
    { id: 'whats-new', label: "What's New", run: openWhatsNew },
    { id: 'scheme-toggle', label: resolveScheme(schemePref, systemLight) === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', run: () => setSchemePref(resolveScheme(schemePref, systemLight) === 'dark' ? 'light' : 'dark') },
    ...PALETTES.map(p => ({ id: `palette-${p}`, label: `Theme: ${PALETTE_LABELS[p]}`, run: () => setPalette(p) })),
  ]

  return (
    <>
      {/* Loading Overlay */}
      <LoadingOverlay
        stage={loadingStage}
        fileCount={loadingFileCount}
        onComplete={finishLoading}
      />

      {showLoadBanner && (
        <LoadBanner
          fileName={loadedFiles.length > 0 ? `${loadedFiles.length} file${loadedFiles.length > 1 ? 's' : ''}` : ''}
          loadTime={loadTime}
          entriesCount={entries.length}
          onClose={closeLoadBanner}
        />
      )}

      {skippedFiles.length > 0 && (
        <SkippedNotice names={skippedFiles} onClose={closeSkippedNotice} />
      )}

      {/* Settings Button - Bottom Right */}
      <button
        type="button"
        className={`pill fixed right-4 bottom-4 z-20 !p-3 text-muted hover:text-accent transition-colors ${settingsOpen ? 'hidden' : ''}`}
        onClick={() => setSettingsOpen(prev => !prev)}
        aria-label="Toggle settings"
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

          await loadFiles(Array.from(e.dataTransfer.files))
        }}
      >
        {/* Global Drop Overlay */}
        {isDraggingGlobal && (
          <div className="fixed inset-0 z-50 scrim flex items-center justify-center pointer-events-none">
            <div className="popup border-2 border-dashed !border-accent px-10 py-8 text-center">
              <div className="kao text-base mb-2">(｀・ω・´)</div>
              <div className="font-extrabold text-accent mb-1">drop log files here</div>
              <div className="text-xs text-muted">any text log, rotated ones too</div>
            </div>
          </div>
        )}

        {/* Hidden file input for browse button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const input = e.target
            await loadFiles(Array.from(input.files ?? []))
            input.value = ''
          }}
        />

        {/* Three-column grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] lg:grid-rows-[minmax(0,1fr)] gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="flex flex-col gap-3 overflow-y-auto"  style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Level Filters */}
            {entries.length > 0 && (
              <section className="glass card">
                <GroupHeading title="log levels" />
                <LevelFilters
                  selectedLevels={filters.selectedLevels}
                  availableLevels={availableLevels}
                  onLevelClick={handleLevelClick}
                />
              </section>
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
              <section className="glass card">
                <GroupHeading title="export & actions" />
                <ExportBar rows={filtered} filters={filters} bookmarked={bookmarkedRows} resetFilters={runClearFilters} />
              </section>
            )}

            {/* Airlock Summary Button */}
            {airlockSummary && (
              <button
                className="btn primary w-full"
                onClick={() => setAirlockModalOpen(prev => !prev)}
              >
                {airlockModalOpen ? 'hide' : 'view'} airlock summary
              </button>
            )}
          </aside>

          {/* Center - Main Content */}
          <main className="flex flex-col gap-3 min-h-0 overflow-hidden">
            {/* Virtual Table */}
            <div ref={tableWrapRef} className="relative flex-1 min-h-0">
              {centerView === 'patterns' ? (
                <PatternsPanel
                  rows={filtered}
                  height={tableHeight}
                  onShowRows={showPatternRows}
                  onJumpTo={(key) => { setSelectedKey(key); setCenterView('rows') }}
                  headerControls={<ViewSwitch view={centerView} onChange={setCenterView} />}
                />
              ) : (
                <VirtualTable
                  rows={filtered}
                  height={tableHeight}
                  highlightRe={highlightRe}
                  bookmarked={bookmarked}
                  onToggleBookmark={toggleBookmark}
                  selectedKey={selectedKey}
                  onSelectRow={setSelectedKey}
                  loadedFiles={loadedFiles}
                  showBookmarksOnly={filters.showBookmarksOnly}
                  onShowBookmarksOnlyChange={(checked) => setFilters(f => ({ ...f, showBookmarksOnly: checked }))}
                  bookmarkContext={filters.bookmarkContext}
                  onBookmarkContextChange={(context) => setFilters(f => ({ ...f, bookmarkContext: context }))}
                  bookmarkCount={bookmarked.size}
                  headerControls={<ViewSwitch view={centerView} onChange={setCenterView} />}
                />
              )}

              {/* Empty State Overlay */}
              {entries.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-panel bg-bg/90 backdrop-blur-sm z-10 pointer-events-none">
                  <div className="text-center">
                    <div className="text-4xl font-extrabold tracking-tight mb-1 text-accent">
                      logninja.
                    </div>
                    <div className="kao text-base mb-5">(っ˘ω˘ς)</div>
                    <div className="text-fg mb-1">drag &amp; drop log files anywhere</div>
                    <div className="text-xs text-muted mb-4">or</div>
                    <button
                      className="btn primary pointer-events-auto"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse files…
                    </button>
                    <div className="lbl mt-4">any text log · .log · .log.1 · .txt · .csv</div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline - Horizontal */}
            {entries.length > 0 && (
              <div className="flex-shrink-0">
                <TimelinePanel
                  entries={timelineEntries}
                  isMatch={showTimelineHits}
                  onSelectRange={(r) => setFilters(f => ({ ...f, timeRange: r }))}
                  activeRange={filters.timeRange ?? null}
                />
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <aside className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Search Bar */}
            {entries.length > 0 && (
              <section className="glass card">
                <GroupHeading title="search" />
                <div className="flex flex-col gap-2">
                  <SearchBar
                    query={filters.query}
                    setQuery={(q) => setFilters(f => ({ ...f, query: q }))}
                    useRegex={filters.useRegex}
                    setUseRegex={(b) => setFilters(f => ({ ...f, useRegex: b }))}
                    highlightOnly={filters.highlightOnly}
                    setHighlightOnly={(b) => setFilters(f => ({ ...f, highlightOnly: b }))}
                    searchMode={filters.searchMode}
                    setSearchMode={(mode) => setFilters(f => ({ ...f, searchMode: mode }))}
                    currentMatchIndex={filters.currentMatchIndex}
                    totalMatches={matchingKeys.length}
                    onNextMatch={goToNextMatch}
                    onPrevMatch={goToPreviousMatch}
                    entries={entries}
                    ref={searchInputRef}
                  />
                  <PresetsDropdown onSelect={(pattern) => setFilters(f => ({ ...f, query: pattern, useRegex: true }))} />
                </div>
              </section>
            )}

            {/* Loaded Files */}
            {loadedFiles.length > 0 && (
              <section className="glass card">
                <GroupHeading title="loaded files">
                  <span className="tabular-nums">{loadedFiles.length}</span>
                </GroupHeading>
                <div className="flex flex-col gap-1.5">
                  {loadedFiles.map(file => {
                    const isSelected = filters.selectedFiles?.includes(file.id) ?? false
                    const hasSelection = (filters.selectedFiles?.length ?? 0) > 0
                    const isArmed = armedFileId === file.id
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between gap-2 pl-2.5 pr-1.5 py-1.5 rounded-inner border cursor-pointer transition-[opacity,border-color] ${
                          isSelected ? 'border-accent bg-accent/10' : 'border-line bg-bg/45 hover:border-line-strong'
                        }`}
                        style={{
                          borderLeft: `3px solid ${file.color}`,
                          opacity: hasSelection ? (isSelected ? 1 : 0.45) : 1
                        }}
                        onClick={(e) => handleFileClick(file.id, e.ctrlKey || e.metaKey)}
                        title="Click to filter to this file only. Ctrl+click to select multiple files."
                      >
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <div className="truncate font-semibold text-xs">{file.name}</div>
                          <div className="text-[11px] text-muted tabular-nums">{file.entryCount.toLocaleString()} entries</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isArmed) {
                              setArmedFileId(null)
                              removeFile(file.id)
                            } else {
                              setArmedFileId(file.id)
                            }
                          }}
                          className={`btn subtle danger !px-2 !py-0.5 pointer-events-auto ${isArmed ? 'armed' : ''}`}
                          aria-label={isArmed ? `Confirm removing ${file.name}` : `Remove ${file.name}`}
                          title={isArmed ? 'Click again to remove' : 'Remove file'}
                        >
                          {isArmed ? 'remove?' : '×'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </aside>
        </div>

        {/* Airlock Summary Modal */}
        {airlockSummary && airlockModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 scrim"
            onClick={(e) => {
              // Close if clicking the backdrop
              if (e.target === e.currentTarget) {
                setAirlockModalOpen(false)
              }
            }}
          >
            <div className="popup w-[min(90vw,1000px)] max-h-[90vh] flex flex-col">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
                <div className="font-semibold">airlock debug summary</div>
                <button
                  className="btn"
                  onClick={() => setAirlockModalOpen(false)}
                >
                  close <kbd className="ml-1">esc</kbd>
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
          palette={palette}
          setPalette={setPalette}
          schemePref={schemePref}
          setSchemePref={setSchemePref}
          scheme={resolveScheme(schemePref, systemLight)}
          onWhatsNew={openWhatsNew}
        />
        <WhatsNewModal release={whatsNew} onClose={closeWhatsNew} />
      </div>
    </>
  )
}
