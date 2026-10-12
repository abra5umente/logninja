import { describe, expect, it } from 'vitest'
import { formatEntryTime } from './formatTime'

describe('formatEntryTime', () => {
  it('shows local time without a zone suffix', () => {
    const time = new Date(2026, 0, 5, 14, 0, 7)
    expect(formatEntryTime({ time, timeStr: '2026-01-05 14:00:07' })).toBe('2026-01-05 14:00:07')
  })

  it('keeps milliseconds when the line had them', () => {
    const time = new Date(2026, 0, 5, 9, 5, 7, 40)
    expect(formatEntryTime({ time, timeStr: '2026-01-05 09:05:07,04' })).toBe('2026-01-05 09:05:07.040')
  })

  it('falls back to the original text when there is no parsed time', () => {
    expect(formatEntryTime({ time: null, timeStr: '12:00' })).toBe('12:00')
  })
})
