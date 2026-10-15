import { describe, expect, it } from 'vitest'
import { parseLog } from './parse'
import { addSearchStep, applySearchSteps, buildMatcher, buildSearchRegex, buildStepsMatcher, describeStep } from './search'
import type { LogEntry, LogLevel, SearchStep } from './types'

describe('buildSearchRegex', () => {
  it('returns null for an empty query', () => {
    expect(buildSearchRegex('   ', false).re).toBeNull()
  })

  it('treats plain text literally and case-insensitively', () => {
    const { re } = buildSearchRegex('a.b', false)
    expect('A.B'.match(re!)).not.toBeNull()
    expect('axb'.match(re!)).toBeNull()
  })

  it('compiles regex mode and strips PCRE (?i)', () => {
    const { re } = buildSearchRegex('(?i)err(or)?', true)
    expect(re?.source).toBe('err(or)?')
    expect(re?.flags).toBe('gi')
  })

  it('rejects invalid and risky patterns', () => {
    expect(buildSearchRegex('(unclosed', true).re).toBeNull()
    expect(buildSearchRegex('a.*.*b', true).re).toBeNull()
    expect(buildSearchRegex('x'.repeat(1001), false).re).toBeNull()
  })
})

const row = (line: number, level: LogLevel, message: string): LogEntry => ({
  index: line - 1, line, time: null, timeStr: '2026-10-15 10:00:00', level, source: '', message, raw: '', fileId: 'a',
})

const rows = [
  row(1, 'ERROR', 'db connection timed out'),
  row(2, 'ERROR', 'db connection refused'),
  row(3, 'INFO', 'db connection opened'),
  row(4, 'ERROR', 'disk full on /var'),
  row(5, 'WARN', 'retrying db connection'),
]

describe('buildMatcher', () => {
  it('matches the time, level and message, case-insensitively', () => {
    expect(rows.filter(buildMatcher('error', false)!).map(r => r.line)).toEqual([1, 2, 4])
    expect(rows.filter(buildMatcher('2026-10-15 10:00', false)!).length).toBe(5)
  })

  it('falls back to plain text when the regex is refused', () => {
    const m = buildMatcher('(unclosed', true)!
    expect(m(row(9, 'INFO', 'an (unclosed bracket'))).toBe(true)
    expect(buildMatcher('  ', true)).toBeNull()
  })
})

describe('search within steps', () => {
  const steps: SearchStep[] = [
    { query: 'db connection', useRegex: false, exclude: false },
    { query: 'error', useRegex: false, exclude: false },
    { query: 'time(d )?out', useRegex: true, exclude: true },
  ]

  it('narrows one step at a time and counts what each step leaves', () => {
    const { rows: left, counts } = applySearchSteps(rows, steps)
    expect(left.map(r => r.line)).toEqual([2])
    expect(counts).toEqual([4, 2, 1])
  })

  it('gives the same rows as one combined test', () => {
    const m = buildStepsMatcher(steps)!
    expect(rows.filter(m)).toEqual(applySearchSteps(rows, steps).rows)
    expect(buildStepsMatcher([])).toBeNull()
  })

  it('passes everything through with no steps', () => {
    expect(applySearchSteps(rows, [])).toEqual({ rows, counts: [] })
  })

  it('adds a step for the current search, skipping empty and repeated ones', () => {
    const one = addSearchStep([], ' error ', false, false)
    expect(one).toEqual([{ query: 'error', useRegex: false, exclude: false }])
    expect(addSearchStep(one, 'error', false, false)).toBe(one)
    expect(addSearchStep(one, '   ', false, false)).toBe(one)
    expect(addSearchStep(one, 'error', false, true)).toHaveLength(2)
  })

  it('describes steps for the trail and exports', () => {
    expect(steps.map(describeStep)).toEqual(['db connection', 'error', 'not /time(d )?out/'])
  })
})

describe('searching for a time', () => {
  it('finds a row by the time the table shows as well as the one the log wrote', () => {
    const [e] = parseLog('1:M 13 Aug 2025 00:00:02.926 * Ready')
    expect(buildMatcher('2025-08-13 00:00', false)!(e)).toBe(true)
    expect(buildMatcher('13 Aug 2025', false)!(e)).toBe(true)
    expect(buildMatcher('2025-08-14', false)!(e)).toBe(false)
  })
})
