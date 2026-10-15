import { describe, expect, it } from 'vitest'
import { findPatterns, groupRows, newPatternGroups, rankPatterns, sparkline, templateOf, templateParts, templateToRegex } from './patterns'
import { buildSearchRegex } from './search'
import { LogEntry, LogLevel } from './types'

let n = 0
const row = (message: string, level: LogLevel = 'INFO', time: Date | null = new Date(2026, 9, 12, 14, 0, n)): LogEntry => ({
  index: n, line: n++, time, timeStr: '', level, source: '', message, raw: message,
})

describe('templateOf', () => {
  it('masks numbers but keeps units and words', () => {
    expect(templateOf('request completed in 641ms')).toBe('request completed in <n>ms')
    expect(templateOf('cache miss key=984 [1234]')).toBe('cache miss key=<n> [<n>]')
    expect(templateOf('retry 3 of 5')).toBe('retry <n> of <n>')
    expect(templateOf('utf8 decoder v7 ready')).toBe('utf8 decoder v7 ready')
  })

  it('masks ips, uuids, hashes, times and emails', () => {
    expect(templateOf('connect from 10.0.0.12:5432 ok')).toBe('connect from <ip> ok')
    expect(templateOf('job 123e4567-e89b-12d3-a456-426614174000 done')).toBe('job <uuid> done')
    expect(templateOf('sha256 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBe('sha256 <hex>')
    expect(templateOf('next run at 2026-10-12T14:00:00Z')).toBe('next run at <time>')
    expect(templateOf('mail to alex@example.com bounced')).toBe('mail to <email> bounced')
  })

  it('masks unix and windows paths', () => {
    expect(templateOf('FILE CHECK Filename=/usr/bin/curl Result=allowed')).toBe('FILE CHECK Filename=<path> Result=allowed')
    expect(templateOf('FILE CHECK Filename: C:\\Program Files (x86)\\Vendor App\\app.exe, Result: Blocked'))
      .toBe('FILE CHECK Filename: <path>, Result: Blocked')
  })

  it('keeps results that differ apart', () => {
    expect(templateOf('Filename=/bin/ls Result=allowed')).not.toBe(templateOf('Filename=/bin/ls Result=blocked'))
  })

  it('uses only the first line', () => {
    expect(templateOf('NullPointerException at 12\n  at foo.bar(Baz.java:42)')).toBe('NullPointerException at <n>')
  })
})

describe('findPatterns', () => {
  it('groups, counts levels and sorts', () => {
    const rows = [
      row('user 1 logged in'), row('user 2 logged in'), row('user 3 logged in'),
      row('disk 91% full', 'WARN'), row('db down', 'ERROR'),
    ]
    const common = findPatterns(rows, 'common').patterns
    expect(common[0].template).toBe('user <n> logged in')
    expect(common[0].count).toBe(3)
    expect(findPatterns(rows, 'rare').patterns[0].count).toBe(1)
    const errors = findPatterns(rows, 'errors').patterns
    expect(errors[0].template).toBe('db down')
    expect(errors[1].levelCounts).toEqual({ WARN: 1 })
  })

  it('records first/last seen and the first row', () => {
    const a = row('ping 1', 'INFO', new Date(2026, 9, 12, 9))
    const b = row('ping 2', 'INFO', new Date(2026, 9, 12, 11))
    const { patterns, sparks } = findPatterns([b, a])
    const p = patterns[0]
    expect(p.first).toEqual(a.time)
    expect(p.last).toEqual(b.time)
    expect(p.firstIndex).toBe(b.index)
    expect(sparks.get(p)!.reduce((s, x) => s + x, 0)).toBe(2)
  })

  it('gives the same result grouped a slice at a time', () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(i % 3 ? `ping ${i}` : `pong from 10.0.0.${i}`, i % 5 ? 'INFO' : 'WARN'))
    const g = newPatternGroups(rows.length)
    let steps = 0
    while (!groupRows(g, rows, 7)) steps++
    expect(steps).toBe(3)
    const sliced = rankPatterns(g, rows, 'common').patterns
    const whole = findPatterns(rows, 'common').patterns
    expect(sliced).toEqual(whole)
  })
})

describe('templateToRegex', () => {
  const hay = (e: LogEntry) => `${e.timeStr} ${e.level} ${e.message}`

  it('matches the rows of its pattern through the search box', () => {
    const msgs = [
      'request completed in 641ms',
      'FILE CHECK Filename: C:\\Program Files (x86)\\Vendor App\\app.exe, Result: Blocked',
      'connect from 10.0.0.12:5432 ok',
      'C++ build took 12.5 s (cached: true)',
    ]
    for (const m of msgs) {
      const { re } = buildSearchRegex(templateToRegex(templateOf(m)), true)
      expect(re, m).not.toBeNull()
      expect(new RegExp(re!.source, 'i').test(hay(row(m)))).toBe(true)
    }
  })

  it("doesn't match a longer line that only starts the same", () => {
    const re = new RegExp(templateToRegex(templateOf('db down')), 'i')
    expect(re.test(' ERROR db down')).toBe(true)
    expect(re.test(' ERROR db down for maintenance')).toBe(false)
  })

  it("doesn't match a line that only ends the same, or a later line of a message", () => {
    const re = new RegExp(templateToRegex(templateOf('Connection closed')), 'i')
    expect(re.test('2026-01-05 10:00:00 INFO Connection closed')).toBe(true)
    expect(re.test('2026-01-05 10:00:00 INFO Upstream said: Connection closed')).toBe(false)
    expect(re.test('2026-01-05 10:00:00 ERROR Error occurred\nConnection closed')).toBe(false)
    const n = new RegExp(templateToRegex(templateOf('42')), 'i')
    expect(n.test(' INFO 42')).toBe(true)
    expect(n.test(' INFO took 17')).toBe(false)
  })

  it('still highlights inside the message cell', () => {
    const re = new RegExp(templateToRegex(templateOf('request completed in 641ms')), 'i')
    expect(re.test('request completed in 12ms')).toBe(true)
  })

  it('matches its own rows when the template was cut short', () => {
    const msgs = ['x ' + '1 '.repeat(200), 'token ' + 'a1'.repeat(450) + ' accepted']
    for (const m of msgs) {
      const tpl = templateOf(m)
      expect(tpl.endsWith('…')).toBe(true)
      expect(tpl).not.toMatch(/<[a-z]*…$/)
      const { re } = buildSearchRegex(templateToRegex(tpl), true)
      expect(re).not.toBeNull()
      expect(new RegExp(re!.source, 'i').test(hay(row(m)))).toBe(true)
    }
  })
})

describe('helpers', () => {
  it('splits placeholders out', () => {
    expect(templateParts('a <n> b')).toEqual([
      { text: 'a ', placeholder: false }, { text: 'n', placeholder: true }, { text: ' b', placeholder: false },
    ])
  })

  it('draws sparklines scaled to the peak', () => {
    expect(sparkline([0, 1, 8])).toBe(' ▁█')
    expect(sparkline([0, 0])).toBe('  ')
  })
})
