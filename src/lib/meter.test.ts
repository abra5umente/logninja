import { describe, expect, it } from 'vitest'
import { meter } from './meter'

describe('meter', () => {
  it('is always the full width', () => {
    for (const f of [0, 0.01, 0.5, 0.99, 1]) {
      const m = meter(f)
      expect(m.on.length + m.off.length).toBe(16)
    }
  })

  it('fills in proportion', () => {
    expect(meter(0).on).toBe('')
    expect(meter(0.5).on).toBe('▰'.repeat(8))
    expect(meter(1).off).toBe('')
  })

  it('shows one cell for any non-zero amount', () => {
    expect(meter(0.001).on).toBe('▰')
  })

  it('clamps bad input', () => {
    expect(meter(2).on.length).toBe(16)
    expect(meter(-1).on).toBe('')
    expect(meter(NaN).on).toBe('')
  })

  it('steps colour at 65% and 85%', () => {
    expect(meter(0.6).level).toBe('')
    expect(meter(0.7).level).toBe('warn')
    expect(meter(0.9).level).toBe('hot')
  })
})
