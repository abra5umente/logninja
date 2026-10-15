import { describe, expect, it } from 'vitest'
import { buildMarkdownSummary } from './export'
import { FiltersState } from './types'

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
