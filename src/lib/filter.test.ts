import { describe, expect, it } from 'vitest'
import { passesBaseFilters, withBookmarkContext } from './filter'
import { FiltersState, LogEntry, LogLevel } from './types'

const filters: FiltersState = {
  selectedLevel: null, selectedLevels: null, selectedFiles: null, query: '', useRegex: false,
  timeRange: null, highlightOnly: false, showBookmarksOnly: true, bookmarkContext: 1,
  searchMode: 'find', currentMatchIndex: 0, searchSteps: [],
}

const entry = (line: number, level: LogLevel = 'INFO', fileId = 'a'): LogEntry => ({
  index: line - 1, line, time: new Date(2026, 0, 5, 10, 0, line), timeStr: '', level,
  source: '', message: `line ${line}`, raw: '', fileId,
})

describe('passesBaseFilters', () => {
  it('applies the file, level and time filters', () => {
    const e = entry(5, 'ERROR', 'b')
    expect(passesBaseFilters(e, filters)).toBe(true)
    expect(passesBaseFilters(e, { ...filters, selectedFiles: ['a'] })).toBe(false)
    expect(passesBaseFilters(e, { ...filters, selectedLevels: ['WARN'] })).toBe(false)
    expect(passesBaseFilters(e, { ...filters, timeRange: { start: new Date(2026, 0, 5, 10, 0, 6), end: new Date(2026, 0, 5, 11) } })).toBe(false)
    expect(passesBaseFilters({ ...e, time: null }, { ...filters, timeRange: { start: new Date(0), end: new Date() } })).toBe(false)
  })
})

describe('withBookmarkContext', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8].map(n => entry(n))

  it('keeps each bookmark and its neighbours', () => {
    expect(withBookmarkContext(rows, new Set(['a:4']), 1).map(e => e.line)).toEqual([3, 4, 5])
    expect(withBookmarkContext(rows, new Set(['a:1', 'a:8']), 2).map(e => e.line)).toEqual([1, 2, 3, 6, 7, 8])
  })

  it('takes context from the rows it is given, so other filters still apply', () => {
    const errorsOnly = [entry(2, 'ERROR'), entry(6, 'ERROR'), entry(9, 'ERROR')]
    expect(withBookmarkContext(errorsOnly, new Set(['a:6']), 1).map(e => e.line)).toEqual([2, 6, 9])
    expect(withBookmarkContext(rows, new Set(), 3)).toEqual([])
  })
})
