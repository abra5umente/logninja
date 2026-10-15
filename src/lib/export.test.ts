import { describe, expect, it } from 'vitest'
import { buildMarkdownSummary, rowsToCSV, rowsToCSVChunks } from './export'
import { FiltersState, LogEntry } from './types'

const filters: FiltersState = {
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
  searchSteps: [],
}

describe('buildMarkdownSummary', () => {
  it('says when the search only highlights', () => {
    expect(buildMarkdownSummary([], { ...filters, query: 'boom' })).toContain('- Search: text: boom (highlighted, not filtered)')
    expect(buildMarkdownSummary([], { ...filters, query: 'boom', searchMode: 'filter' })).toContain('- Search: text: boom\n')
  })

  it('keeps a multi-line message inside its list item', () => {
    const row = { index: 0, line: 1, time: null, timeStr: '', level: 'ERROR', source: '', message: 'Exception\nat foo', raw: '' } as LogEntry
    expect(buildMarkdownSummary([row], filters)).toContain('- 1 × Exception\n  at foo')
  })

  it('says all levels when none are picked', () => {
    expect(buildMarkdownSummary([], filters)).toContain('- Active levels: all')
  })

  it('lists the levels picked in the level filter', () => {
    expect(buildMarkdownSummary([], { ...filters, selectedLevels: ['ERROR', 'WARN'] })).toContain('- Active levels: ERROR, WARN')
  })

  it('lists the search within steps in order', () => {
    const steps = [
      { query: 'error', useRegex: false, exclude: false },
      { query: 'time(d )?out', useRegex: true, exclude: true },
    ]
    expect(buildMarkdownSummary([], { ...filters, searchSteps: steps })).toContain('- Searching within: error › not /time(d )?out/')
    expect(buildMarkdownSummary([], filters)).not.toContain('Searching within')
  })
})

describe('rowsToCSVChunks', () => {
  const row = (i: number): LogEntry => ({ index: i, line: i + 1, time: null, timeStr: `t${i}`, level: 'INFO', source: '', message: `msg, ${i}`, raw: '' })

  it('splits a big export into pieces that join into the whole CSV', () => {
    const rows = Array.from({ length: 25_000 }, (_, i) => row(i))
    const chunks = rowsToCSVChunks(rows, [row(7)])
    expect(chunks.length).toBe(3)
    const lines = chunks.join('').split('\n')
    expect(lines[0]).toBe('Time,Level,Message')
    expect(lines[1]).toBe('t0,INFO,"msg, 0"')
    expect(lines[25_000]).toBe('t24999,INFO,"msg, 24999"')
    expect(lines.slice(25_001)).toEqual(['', 'Bookmarked Lines', 'Time,Level,Message', 't7,INFO,"msg, 7"'])
  })

  it('gives one piece for a small export', () => {
    expect(rowsToCSVChunks([row(0)])).toEqual(['Time,Level,Message\nt0,INFO,"msg, 0"'])
    expect(rowsToCSV([])).toBe('Time,Level,Message')
  })
})
