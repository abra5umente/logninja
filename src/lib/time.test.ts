import { describe, expect, it } from 'vitest'
import { DAY, buildBins, formatRange, formatStep, formatTick, pickBinMs, timeExtent } from './time'
import { LogEntry, LogLevel } from './types'

// Dates are built with the local-time constructor so the tests pass in any timezone.
const at = (h: number, m = 0, s = 0, day = 12) => new Date(2026, 9, day, h, m, s)

let n = 0
const entry = (time: Date | null, level: LogLevel = 'INFO', message = ''): LogEntry => ({
  index: n++, time, timeStr: '', level, message, raw: message,
} as LogEntry)

describe('pickBinMs', () => {
  it('keeps the bar count at or under the limit', () => {
    expect(pickBinMs(60 * 1000)).toBe(1000)
    expect(pickBinMs(3600 * 1000)).toBe(60 * 1000)
    expect(pickBinMs(DAY)).toBe(30 * 60 * 1000)
    expect(pickBinMs(30 * DAY)).toBe(12 * 3600 * 1000)
  })

  it('falls back to whole days for very long spans', () => {
    expect(pickBinMs(3 * 365 * DAY) % DAY).toBe(0)
    expect(3 * 365 * DAY / pickBinMs(3 * 365 * DAY)).toBeLessThanOrEqual(72)
  })
})

describe('timeExtent', () => {
  it('ignores rows without a time and has an exclusive end', () => {
    const r = timeExtent([entry(null), entry(at(14, 5)), entry(at(9)), entry(null)])!
    expect(r.start).toEqual(at(9))
    expect(r.end.getTime()).toBe(at(14, 5).getTime() + 1)
  })

  it('is null with nothing timestamped', () => {
    expect(timeExtent([entry(null)])).toBeNull()
  })
})

describe('buildBins', () => {
  it('aligns bins to the local clock and counts per level', () => {
    const rows = [entry(at(14, 3), 'ERROR'), entry(at(14, 4), 'INFO'), entry(at(14, 31), 'WARN'), entry(null, 'ERROR')]
    const bins = buildBins(rows, { start: at(14, 3), end: at(14, 32) }, 15 * 60 * 1000)
    expect(bins.map(b => b.start.getMinutes())).toEqual([0, 15, 30])
    expect(bins.map(b => b.count)).toEqual([2, 0, 1])
    expect(bins[0].levelCounts).toEqual({ ERROR: 1, INFO: 1 })
    expect(bins[2].end).toEqual(at(14, 45))
  })

  it('starts day bins at local midnight', () => {
    const bins = buildBins([entry(at(23, 59, 0, 10)), entry(at(0, 0, 1, 12))], { start: at(23, 59, 0, 10), end: at(0, 0, 2, 12) }, DAY)
    expect(bins).toHaveLength(3)
    expect(bins.every(b => b.start.getHours() === 0 && b.start.getMinutes() === 0)).toBe(true)
    expect(bins.map(b => b.count)).toEqual([1, 0, 1])
  })

  it('leaves out rows outside the range and counts matches', () => {
    const rows = [entry(at(13), 'INFO', 'denied'), entry(at(14, 0, 10), 'INFO', 'denied'), entry(at(14, 0, 20), 'INFO', 'ok')]
    const bins = buildBins(rows, { start: at(14), end: at(14, 1) }, 30 * 1000, e => e.message === 'denied')
    expect(bins.map(b => b.count)).toEqual([2, 0])
    expect(bins.map(b => b.matches)).toEqual([1, 0])
  })
})

describe('labels', () => {
  it('shows seconds only for sub-minute bars', () => {
    expect(formatTick(at(9, 5), 60 * 1000, false)).toBe('09:05')
    expect(formatTick(at(9, 5, 7), 1000, false)).toBe('09:05:07')
    expect(formatTick(at(9, 5), 60 * 1000, true)).toMatch(/ 09:05$/)
  })

  it('writes a same-day range once', () => {
    expect(formatRange({ start: at(14), end: at(15) }, 60 * 1000)).toMatch(/ 14:00 – 15:00$/)
    expect(formatRange({ start: at(23), end: at(0, 0, 0, 13) }, 60 * 1000)).toMatch(/ 23:00 – 00:00$/)
  })

  it('names bar widths', () => {
    expect(formatStep(1000)).toBe('1 sec')
    expect(formatStep(15 * 60 * 1000)).toBe('15 min')
    expect(formatStep(6 * 3600 * 1000)).toBe('6 hours')
    expect(formatStep(DAY)).toBe('1 day')
  })
})
