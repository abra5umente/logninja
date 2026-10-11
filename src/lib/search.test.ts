import { describe, expect, it } from 'vitest'
import { buildSearchRegex } from './search'

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
