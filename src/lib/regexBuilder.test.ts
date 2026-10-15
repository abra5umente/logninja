import { describe, it, expect } from 'vitest'
import { buildPattern, createTerm, queryFromSearch, termToPattern, validateTerm, type BuilderQuery } from './regexBuilder'
import { buildSearchRegex } from './search'

function q(mode: 'any' | 'all', include: string[], exclude: string[] = []): BuilderQuery {
  return { mode, include: include.map(v => createTerm(v)), exclude: exclude.map(v => createTerm(v)) }
}

// Matches the way App filters: the search's own regex, without the g flag
function matches(query: BuilderQuery, line: string): boolean {
  const { pattern } = buildPattern(query)
  const { re } = buildSearchRegex(pattern, true)
  if (!re) throw new Error(`rejected: ${pattern}`)
  return new RegExp(re.source, re.flags.replace('g', '')).test(line)
}

function highlights(query: BuilderQuery, text: string): string[] {
  const { re } = buildSearchRegex(buildPattern(query).pattern, true)
  return text.match(re!) ?? []
}

describe('termToPattern', () => {
  it('escapes text and turns * into a lazy wildcard', () => {
    expect(termToPattern(createTerm('a.b'))).toBe('a\\.b')
    expect(termToPattern(createTerm('C:\\Program Files\\**\\app.exe'))).toBe('C:\\\\Program Files\\\\.*?\\\\app\\.exe')
  })

  it('wraps regex terms and drops (?i)', () => {
    expect(termToPattern(createTerm('(?i)a|b', 'regex'))).toBe('(?:a|b)')
  })
})

describe('validateTerm', () => {
  it('rejects blank, star-only, broken and slow terms', () => {
    expect(validateTerm(createTerm('  ')).valid).toBe(false)
    expect(validateTerm(createTerm('**')).valid).toBe(false)
    expect(validateTerm(createTerm('(', 'regex')).valid).toBe(false)
    expect(validateTerm(createTerm('a.*.*b', 'regex')).valid).toBe(false)
    expect(validateTerm(createTerm('(error', 'text')).valid).toBe(true)
  })
})

describe('buildPattern', () => {
  it('ignores blank terms and returns nothing for an empty query', () => {
    expect(buildPattern(q('any', ['', ' '])).pattern).toBe('')
    expect(buildPattern(q('any', ['error', ''])).pattern).toBe('error')
  })

  it('joins "any" terms with |', () => {
    expect(buildPattern(q('any', ['error', 'warn'])).pattern).toBe('error|warn')
    expect(matches(q('any', ['error', 'timeout']), 'db timeout')).toBe(true)
    expect(matches(q('any', ['error', 'timeout']), 'all good')).toBe(false)
  })

  it('needs every "all" term, in any order, and highlights each', () => {
    const query = q('all', ['error', 'timeout'])
    expect(matches(query, '12:00 ERROR db timeout')).toBe(true)
    expect(matches(query, 'timeout then error')).toBe(true)
    expect(matches(query, 'error only')).toBe(false)
    expect(highlights(query, 'ERROR db timeout')).toEqual(['ERROR', 'timeout'])
  })

  it('skips lines with an excluded term, wherever it is', () => {
    const query = q('any', ['error'], ['heartbeat', 'retry*ok'])
    expect(matches(query, 'error in sync')).toBe(true)
    expect(matches(query, 'heartbeat error')).toBe(false)
    expect(matches(query, 'error, retry 3 ok')).toBe(false)
    expect(matches(query, 'error\ncontinuation heartbeat')).toBe(false)
  })

  it('handles exclusions with no wanted terms', () => {
    const query = q('any', [], ['heartbeat'])
    expect(matches(query, 'anything else')).toBe(true)
    expect(matches(query, 'heartbeat')).toBe(false)
  })

  it('reports the bad term instead of building', () => {
    const query: BuilderQuery = { mode: 'any', include: [createTerm('ok'), createTerm('(', 'regex')], exclude: [] }
    const r = buildPattern(query)
    expect(r.pattern).toBe('')
    expect(r.error).toContain('"("')
  })

  it('keeps wildcard terms within the search limits', () => {
    const query = q('all', ['*a*', 'b*'], ['*c'])
    const { pattern, error } = buildPattern(query)
    expect(error).toBeUndefined()
    expect(buildSearchRegex(pattern, true).re).not.toBeNull()
  })

  it('refuses queries the search would reject for length', () => {
    const query = q('any', Array.from({ length: 200 }, (_, i) => `term${i}`))
    expect(buildPattern(query).error).toMatch(/too long/)
  })
})

describe('queryFromSearch', () => {
  it('starts empty, or from plain text', () => {
    expect(queryFromSearch('', false).include.map(t => t.value)).toEqual([''])
    expect(queryFromSearch('disk full', false).include.map(t => t.value)).toEqual(['disk full'])
  })

  it('splits a plain alternation (like the presets) into text terms', () => {
    const r = queryFromSearch('(?i)(Add-MpPreference|Bypass|IEX)', true)
    expect(r.include.map(t => [t.value, t.kind])).toEqual([['Add-MpPreference', 'text'], ['Bypass', 'text'], ['IEX', 'text']])
  })

  it('keeps any other regex as one regex term', () => {
    const r = queryFromSearch('err(or)?|warn\\d', true)
    expect(r.include.map(t => [t.value, t.kind])).toEqual([['err(or)?|warn\\d', 'regex']])
    expect(queryFromSearch('(a)|(b)', true).include[0].kind).toBe('regex')
  })
})

describe('edge cases', () => {
  it('keeps spaces at either end of a text term', () => {
    expect(matches(q('any', ['error ']), 'an error here')).toBe(true)
    expect(matches(q('any', ['error ']), 'two errors')).toBe(false)
    expect(matches(q('any', [' id']), 'user id=5')).toBe(true)
    expect(matches(q('any', [' id']), 'userid=5')).toBe(false)
  })

  it('refuses backreferences and named groups, which combining would break', () => {
    expect(validateTerm(createTerm('(b)\\1', 'regex')).valid).toBe(false)
    expect(validateTerm(createTerm('(?<x>a)\\k<x>', 'regex')).valid).toBe(false)
    expect(validateTerm(createTerm('(?<x>a)', 'regex')).valid).toBe(false)
    expect(validateTerm(createTerm('(?<=a)b(?<!c)', 'regex')).valid).toBe(true)
    expect(validateTerm(createTerm('C:\\\\1', 'regex')).valid).toBe(true)
  })
})
