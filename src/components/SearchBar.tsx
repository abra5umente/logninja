import React, { forwardRef, useState } from 'react'
import RegexBuilder from './RegexBuilder'
import { type BuilderQuery, queryFromSearch } from '../lib/regexBuilder'
import { useSavedQueries } from '../lib/savedQueries'
import { describeStep } from '../lib/search'
import type { LogEntry, SearchStep } from '../lib/types'

interface Props {
  query: string
  setQuery: (s: string) => void
  useRegex: boolean
  setUseRegex: (b: boolean) => void
  highlightOnly: boolean
  setHighlightOnly: (b: boolean) => void
  searchMode: 'filter' | 'find'
  setSearchMode: (mode: 'filter' | 'find') => void
  currentMatchIndex?: number
  totalMatches?: number
  onNextMatch?: () => void
  onPrevMatch?: () => void
  /** The rows the search runs within (after the file, level, time and search-within filters), for the query builder's live preview */
  entries?: LogEntry[]
  /** "Search within" steps, the rows left after each, and the rows before the first */
  steps?: SearchStep[]
  stepCounts?: number[]
  totalBeforeSteps?: number
  /** Pin the current search as a step: keep its matches, or (exclude) hide them */
  onSearchWithin?: (exclude: boolean) => void
  onRemoveStep?: (index: number) => void
  /** Drop every step after this one */
  onBackToStep?: (index: number) => void
  onClearSteps?: () => void
}

/** What the builder last applied, so reopening it picks up where you left off */
interface LastBuilt {
  pattern: string
  query: BuilderQuery
  savedId: string | null
}

const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar({
  query, setQuery, useRegex, setUseRegex, highlightOnly, setHighlightOnly,
  searchMode, setSearchMode, currentMatchIndex, totalMatches, onNextMatch, onPrevMatch, entries,
  steps = [], stepCounts = [], totalBeforeSteps, onSearchWithin, onRemoveStep, onBackToStep, onClearSteps
}, ref) {
  const [builderStart, setBuilderStart] = useState<{ query: BuilderQuery; savedId: string | null } | null>(null)
  const [lastBuilt, setLastBuilt] = useState<LastBuilt | null>(null)
  const saved = useSavedQueries()
  const current = query.trim()
  const editingExisting = useRegex && !!current &&
    (lastBuilt?.pattern === current || saved.some(s => s.pattern === current))

  const handleApplyRegex = (pattern: string, built: BuilderQuery, savedId: string | null) => {
    setQuery(pattern)
    setUseRegex(true)
    setLastBuilt({ pattern, query: built, savedId })
  }

  // Reopen what's in the search box: the query the builder made, a saved
  // query with the same regex (e.g. picked from the presets), or a fresh
  // query seeded from whatever was typed.
  const openBuilder = () => {
    if (useRegex && current && lastBuilt?.pattern === current) {
      setBuilderStart({ query: lastBuilt.query, savedId: lastBuilt.savedId })
      return
    }
    const match = useRegex && current ? saved.find(s => s.pattern === current) : undefined
    if (match) {
      setBuilderStart({ query: match.query, savedId: match.id })
      return
    }
    setBuilderStart({ query: queryFromSearch(current, useRegex), savedId: null })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search within: the pinned steps as a trail, each narrowing the one before */}
      {steps.length > 0 && (
        <div className="flex flex-col gap-1 rounded-inner border border-line bg-bg/45 p-2" aria-label="Searching within">
          <div className="flex items-center gap-2">
            <span className="lbl">searching within</span>
            <span className="flex-1" />
            <button type="button" onClick={onClearSteps} className="text-[11px] text-muted hover:text-fg" title="Remove every step and search all rows again">
              clear
            </button>
          </div>
          <button
            type="button"
            onClick={onClearSteps}
            className="flex items-center gap-2 text-left text-[11px] text-muted hover:text-fg"
            title="Back to all rows"
          >
            <span className="flex-1">all rows</span>
            {totalBeforeSteps !== undefined && <span className="tabular-nums">{totalBeforeSteps.toLocaleString()}</span>}
          </button>
          {steps.map((step, i) => {
            const label = describeStep(step)
            const last = i === steps.length - 1
            return (
              <div key={`${i}-${label}`} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-muted" aria-hidden>{'›'}</span>
                <button
                  type="button"
                  onClick={() => onBackToStep?.(i)}
                  disabled={last}
                  className={`flex-1 min-w-0 flex items-center gap-2 text-left ${last ? 'text-fg cursor-default' : 'text-muted hover:text-fg'}`}
                  title={last ? label : `Back to this step (drops the steps after it): ${label}`}
                >
                  <span className={`truncate ${step.exclude ? 'text-magenta' : 'text-accent'}`}>{label}</span>
                  <span className="flex-1" />
                  <span className="tabular-nums">{(stepCounts[i] ?? 0).toLocaleString()}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveStep?.(i)}
                  className="px-1 text-muted hover:text-fg rounded-chip"
                  aria-label={`Remove step ${label}`}
                  title="Remove this step"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={useRegex ? 'regex, e.g. error|warn' : 'search…'}
          ref={ref}
          className="in pr-8"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-fg rounded-chip"
            aria-label="Clear search"
            title="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Search within the matches: pin this search and start the next one */}
      {current && onSearchWithin && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSearchWithin(false)}
            className="btn flex-1 !px-2 !py-1 !text-[11px]"
            title="Keep only the rows matching this search, then search within them (Ctrl+Enter)"
          >
            search within these
          </button>
          <button
            type="button"
            onClick={() => onSearchWithin(true)}
            className="btn flex-1 !px-2 !py-1 !text-[11px]"
            title="Hide the rows matching this search, then keep searching the rest (Ctrl+Shift+Enter)"
          >
            hide these
          </button>
        </div>
      )}

      {/* Search Mode Toggle */}
      <div className="seg full" role="radiogroup" aria-label="Search mode">
        <button
          onClick={() => setSearchMode('find')}
          className={searchMode === 'find' ? 'on' : ''}
          role="radio"
          aria-checked={searchMode === 'find'}
          title="Jump to matches (like VS Code)"
        >
          find
        </button>
        <button
          onClick={() => setSearchMode('filter')}
          className={searchMode === 'filter' ? 'on' : ''}
          role="radio"
          aria-checked={searchMode === 'filter'}
          title="Show only matching entries"
        >
          filter
        </button>
      </div>

      {/* Find Mode Navigation */}
      {searchMode === 'find' && query && totalMatches !== undefined && (
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevMatch}
            disabled={totalMatches === 0}
            className="btn !px-2.5"
            title="Previous match (Shift+Enter)"
          >
            ↑
          </button>
          <div className={`flex-1 text-center text-xs tabular-nums ${totalMatches === 0 ? 'text-muted' : ''}`}>
            {totalMatches === 0 ? 'no matches' : `${(currentMatchIndex ?? 0) + 1} of ${totalMatches}`}
          </div>
          <button
            onClick={onNextMatch}
            disabled={totalMatches === 0}
            className="btn !px-2.5"
            title="Next match (Enter)"
          >
            ↓
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="inline-flex items-center gap-2 text-xs select-none cursor-pointer">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
          />
          regex
        </label>
        <label className="inline-flex items-center gap-2 text-xs select-none cursor-pointer">
          <input
            type="checkbox"
            checked={highlightOnly}
            onChange={(e) => setHighlightOnly(e.target.checked)}
          />
          highlight only
        </label>
      </div>

      {/* Regex Builder Button */}
      <button
        onClick={openBuilder}
        className="btn w-full flex items-center justify-center gap-2"
        title="Build a search from simple terms, and save it for later"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-accent">
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
        {editingExisting ? 'edit query' : 'build query'}
      </button>

      {/* Regex Builder Modal */}
      {builderStart && (
        <RegexBuilder
          onClose={() => setBuilderStart(null)}
          onApply={handleApplyRegex}
          initialQuery={builderStart.query}
          initialSavedId={builderStart.savedId}
          entries={entries}
        />
      )}
    </div>
  )
})

export default SearchBar
