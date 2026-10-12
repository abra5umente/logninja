import { describe, it, expect } from 'vitest'
import { parseSavedQueries, serializeSavedQueries, type SavedQuery } from './savedQueries'
import { createTerm } from './regexBuilder'

describe('saved queries storage', () => {
  it('round-trips through JSON without term ids', () => {
    const list: SavedQuery[] = [{
      id: 'q1', name: 'db errors', pattern: 'x', updatedAt: 5,
      query: { mode: 'all', include: [createTerm('error'), createTerm('db\\d', 'regex')], exclude: [createTerm('test')] },
    }]
    const json = serializeSavedQueries(list)
    expect(json).not.toContain('term-')
    const back = parseSavedQueries(json)
    expect(back).toHaveLength(1)
    expect(back[0].name).toBe('db errors')
    expect(back[0].query.mode).toBe('all')
    expect(back[0].query.include.map(t => [t.value, t.kind])).toEqual([['error', 'text'], ['db\\d', 'regex']])
    expect(back[0].query.exclude.map(t => t.value)).toEqual(['test'])
  })

  it('drops junk instead of failing', () => {
    expect(parseSavedQueries(null)).toEqual([])
    expect(parseSavedQueries('not json')).toEqual([])
    expect(parseSavedQueries('{"a":1}')).toEqual([])
    const r = parseSavedQueries(JSON.stringify([
      null,
      { id: 1, name: 'bad id', pattern: 'x' },
      { id: 'ok', name: 'ok', pattern: 'x', query: { mode: 'weird', include: [{ value: 'a', kind: 'nope' }, { value: 'b', kind: 'text' }] } },
    ]))
    expect(r).toHaveLength(1)
    expect(r[0].query.mode).toBe('any')
    expect(r[0].query.include.map(t => t.value)).toEqual(['b'])
    expect(r[0].query.exclude).toEqual([])
  })
})
