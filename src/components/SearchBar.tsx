import React, { forwardRef } from 'react'

interface Props {
  query: string
  setQuery: (s: string) => void
  useRegex: boolean
  setUseRegex: (b: boolean) => void
  highlightOnly: boolean
  setHighlightOnly: (b: boolean) => void
}

const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar({ query, setQuery, useRegex, setUseRegex, highlightOnly, setHighlightOnly }, ref) {
  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
        <input
          type="checkbox"
          checked={highlightOnly}
          onChange={(e) => setHighlightOnly(e.target.checked)}
        />
        Highlight only
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={useRegex ? 'Regex search (e.g. error|warn)' : 'Search…'}
          ref={ref}
          className="w-64 md:w-96 px-3 py-2 pr-10 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
            aria-label="Clear search"
            title="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
        <input
          type="checkbox"
          checked={useRegex}
          onChange={(e) => setUseRegex(e.target.checked)}
        />
        Regex
      </label>
    </div>
  )
})

export default SearchBar
