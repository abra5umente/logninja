import { describe, expect, it } from 'vitest'
import { scrollMap } from './scrollMap'

describe('scrollMap', () => {
  it('leaves positions alone when the rows fit', () => {
    const m = scrollMap(28_000, 33_554_428, 700)
    expect(m.spacer).toBe(28_000)
    expect(m.toVirtual(1234)).toBe(1234)
    expect(m.toPhysical(1234)).toBe(1234)
  })

  it('caps the spacer and still reaches the last row', () => {
    const total = 3_000_000 * 28
    const max = 33_554_428
    const viewH = 700
    const m = scrollMap(total, max, viewH)
    expect(m.spacer).toBe(max)
    // Scrolled to the bottom: the window shows the last viewH pixels of the rows
    expect(m.toVirtual(max - viewH)).toBeCloseTo(total - viewH, 3)
    expect(m.toVirtual(0)).toBe(0)
    expect(m.toVirtual(m.toPhysical(50_000_000))).toBeCloseTo(50_000_000, 3)
  })
})
