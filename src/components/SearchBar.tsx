import React, { forwardRef, useState } from 'react'
import RegexBuilder from './RegexBuilder'

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
}

const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar({
  query, setQuery, useRegex, setUseRegex, highlightOnly, setHighlightOnly,
  searchMode, setSearchMode, currentMatchIndex, totalMatches, onNextMatch, onPrevMatch
}, ref) {
  const [showRegexBuilder, setShowRegexBuilder] = useState(false)

  const handleApplyRegex = (regex: string) => {
    setQuery(regex)
    setUseRegex(true)
  }

  return (
    <>
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={useRegex ? 'Regex search (e.g. error|warn)' : 'Search…'}
          ref={ref}
          className="w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            aria-label="Clear search"
            title="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Mode Toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setSearchMode('find')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            searchMode === 'find'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="Jump to matches (like VS Code)"
        >
          Find
        </button>
        <button
          onClick={() => setSearchMode('filter')}
          className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
            searchMode === 'filter'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="Show only matching entries"
        >
          Filter
        </button>
      </div>

      {/* Find Mode Navigation */}
      {searchMode === 'find' && query && totalMatches !== undefined && (
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevMatch}
            disabled={totalMatches === 0}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous match (Shift+Enter)"
          >
            ↑
          </button>
          <div className="flex-1 text-center text-xs text-gray-600 dark:text-gray-400">
            {totalMatches === 0 ? 'No matches' : `${(currentMatchIndex ?? 0) + 1} of ${totalMatches}`}
          </div>
          <button
            onClick={onNextMatch}
            disabled={totalMatches === 0}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next match (Enter)"
          >
            ↓
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none">
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
          />
          Regex
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 select-none">
          <input
            type="checkbox"
            checked={highlightOnly}
            onChange={(e) => setHighlightOnly(e.target.checked)}
          />
          Highlight only
        </label>
      </div>

      {/* Regex Builder Button */}
      <button
        onClick={() => setShowRegexBuilder(true)}
        className="w-full px-3 py-2 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        title="Visual regex pattern builder"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
        </svg>
        Build Query
      </button>
    </div>

    {/* Regex Builder Modal */}
    {showRegexBuilder && (
      <RegexBuilder
        onClose={() => setShowRegexBuilder(false)}
        onApply={handleApplyRegex}
        initialQuery={query}
      />
    )}
    </>
  )
})

export default SearchBar
