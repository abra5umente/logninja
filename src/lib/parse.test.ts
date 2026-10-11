import { describe, expect, it } from 'vitest'
import { parseLog } from './parse'

describe('parseLog', () => {
  it('parses an ISO timestamp and level', () => {
    const [entry] = parseLog('2025-08-13T00:00:22Z ERROR Something broke', 'f1', 'app.log')
    expect(entry.time?.toISOString()).toBe('2025-08-13T00:00:22.000Z')
    expect(entry.level).toBe('ERROR')
    expect(entry.message).toBe('Something broke')
    expect(entry.fileId).toBe('f1')
    expect(entry.fileName).toBe('app.log')
  })

  it('parses "YYYY-MM-DD HH:mm:ss,SSS" as local time', () => {
    const [entry] = parseLog('2025-08-13 09:15:30,123 [WARN] Disk nearly full')
    expect(entry.time?.getTime()).toBe(new Date(2025, 7, 13, 9, 15, 30, 123).getTime())
    expect(entry.level).toBe('WARN')
    expect(entry.message).toBe('Disk nearly full')
  })

  it('defaults to INFO when the line has no level', () => {
    const [entry] = parseLog('2025-08-13 09:15:30 just a message')
    expect(entry.level).toBe('INFO')
  })

  it('appends lines without a timestamp to the previous entry', () => {
    const entries = parseLog([
      '2025-08-13 09:15:30 ERROR Exception thrown',
      '    at foo (bar.js:1:1)',
      '2025-08-13 09:15:31 INFO Recovered',
    ].join('\n'))
    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe('Exception thrown\n    at foo (bar.js:1:1)')
    expect(entries[1].index).toBe(1)
  })

  it('maps Apache status codes to levels', () => {
    const line = (status: number) =>
      `127.0.0.1 - - [13/Aug/2025:00:00:23 +1000] "GET / HTTP/1.1" ${status} 0 "-" "curl/8.0"`
    const levels = parseLog([line(200), line(404), line(503)].join('\n')).map(e => e.level)
    expect(levels).toEqual(['INFO', 'WARN', 'ERROR'])
  })

  it('parses MongoDB structured JSON lines', () => {
    const [entry] = parseLog('{"t":{"$date":"2025-08-13T00:00:00.000+00:00"},"s":"W","c":"NETWORK","msg":"Slow query"}')
    expect(entry.level).toBe('WARN')
    expect(entry.source).toBe('NETWORK')
    expect(entry.message).toBe('Slow query')
  })
})
