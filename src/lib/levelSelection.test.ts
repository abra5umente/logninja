import { describe, expect, it } from 'vitest'
import { nextLevelSelection } from './levelSelection'

describe('nextLevelSelection', () => {
  it('plain click adds a level without clearing the others', () => {
    expect(nextLevelSelection(null, 'ERROR', false)).toEqual(['ERROR'])
    expect(nextLevelSelection(['ERROR'], 'WARN', false)).toEqual(['ERROR', 'WARN'])
  })

  it('plain click on a selected level turns it off', () => {
    expect(nextLevelSelection(['ERROR', 'WARN'], 'ERROR', false)).toEqual(['WARN'])
  })

  it('turning off the last level clears the filter', () => {
    expect(nextLevelSelection(['ERROR'], 'ERROR', false)).toBeNull()
  })

  it('ctrl/cmd+click shows only that level', () => {
    expect(nextLevelSelection(['ERROR', 'WARN'], 'INFO', true)).toEqual(['INFO'])
    expect(nextLevelSelection(['ERROR', 'WARN'], 'ERROR', true)).toEqual(['ERROR'])
  })

  it('ctrl/cmd+click on the only selected level clears the filter', () => {
    expect(nextLevelSelection(['ERROR'], 'ERROR', true)).toBeNull()
  })
})
