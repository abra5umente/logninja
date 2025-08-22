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
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={useRegex ? 'Regex search (e.g. error|warn)' : 'Search…'}
        ref={ref}
        className="w-64 md:w-96 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
      />
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
