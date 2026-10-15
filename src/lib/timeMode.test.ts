import { describe, expect, it } from 'vitest'
import { inLogTime, zoneOffsetOf } from './timeMode'
import { formatEntryTime } from './formatTime'
import { parseLog } from './parse'

describe('zoneOffsetOf', () => {
  it('reads the zone a timestamp was written in', () => {
    expect(zoneOffsetOf('2026-01-05T10:00:00Z')).toBe(0)
    expect(zoneOffsetOf('2026-01-05T10:00:00+10:00')).toBe(600)
    expect(zoneOffsetOf('13/Aug/2025:00:00:23 +1000')).toBe(600)
    expect(zoneOffsetOf('2026-01-05 10:00:00.5-05:30')).toBe(-330)
  })

  it('finds none in a timestamp without a zone', () => {
    expect(zoneOffsetOf('2026-01-05 10:00:00')).toBeNull()
    expect(zoneOffsetOf('01/13/2026 9:00:00 AM')).toBeNull()
    expect(zoneOffsetOf('2025-08-13 12:16:41:491')).toBeNull()
  })
})

describe('inLogTime', () => {
  it('shows a zoned time on the clock the log was written in', () => {
    const entries = parseLog([
      '2026-01-05T10:00:00Z INFO utc',
      '2026-01-05T21:00:00+11:00 INFO sydney',
      '2026-01-05 08:00:00 INFO no zone',
    ].join('\n'))
    const shown = inLogTime(entries).map(formatEntryTime)
    expect(shown).toEqual(['2026-01-05 10:00:00', '2026-01-05 21:00:00', '2026-01-05 08:00:00'])
  })

  it('hands back the same array when nothing moves', () => {
    const entries = parseLog('2026-01-05 08:00:00 INFO no zone')
    expect(inLogTime(entries)).toBe(entries)
  })
})
