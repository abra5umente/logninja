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

// All lines below are made up to match the shape of Airlock agent and server logs; none are copied from a real system.
describe('parseLog: Airlock agent lines', () => {
  const blocked = (result: string) =>
    `2026-01-05 10:00:03 FILE CHECK Filename=/usr/share/info/error Hash="${'ab'.repeat(32)} not found in the database" Type=2 Result="${result}" Blocking Reasons==> GrandParent="/usr/sbin/sshd not found in Process Exclusion" Parent="/usr/bin/bash not found in Process Exclusion" Path="/usr/share/info/error not found in Path Exclusions" Publisher="Debug Tools <warn@example.com> not found in Publisher Exclusions"`

  it('keeps the whole FILE CHECK line as the message even when paths contain level words', () => {
    const [entry] = parseLog(blocked('Blocking File - Untrusted Execution'))
    expect(entry.time?.getTime()).toBe(new Date(2026, 0, 5, 10, 0, 3).getTime())
    expect(entry.source).toBe('FILE CHECK')
    expect(entry.message.startsWith('FILE CHECK Filename=/usr/share/info/error Hash=')).toBe(true)
    expect(entry.message.endsWith('not found in Publisher Exclusions"')).toBe(true)
  })

  it('takes the FILE CHECK level from the result', () => {
    const levels = parseLog([
      blocked('Blocking File - Untrusted Execution'),
      blocked('(CACHED) Blocking File - Untrusted Execution [Audit]'),
      '2026-01-05 10:00:04 FILE CHECK Filename=/usr/bin/ls Hash="' + 'cd'.repeat(32) + ' found in the database" Type=2 Result="Allowing File"',
    ].join('\n')).map(e => e.level)
    expect(levels).toEqual(['ERROR', 'WARN', 'INFO'])
  })

  it('parses agent INFO and ERROR lines and skips the blank lines between them', () => {
    const entries = parseLog([
      '2026-01-05 10:00:01 INFO  MAXPROCS (default) = 4',
      '',
      '2026-01-05 10:00:02 ERROR [/build/agent/airlock/agent.go:100] Download failed: http status 400',
    ].join('\n'))
    expect(entries.map(e => e.level)).toEqual(['INFO', 'ERROR'])
    expect(entries[0].message).toBe('MAXPROCS (default) = 4')
    expect(entries[1].message).toBe('[/build/agent/airlock/agent.go:100] Download failed: http status 400')
  })
})

describe('parseLog: Airlock Windows agent lines', () => {
  // Made-up lines in the Windows agent's tab-separated format
  const w = (ts: string, kind: string, thread: number, msg: string) => `${ts}\t${kind}\t${thread}\t${msg}`
  const hash = 'ab'.repeat(32)
  const check = (file: string, result: string) =>
    w('01/13/2026 9:00:03 AM', 'FILE CHECK', 300, `Filename: ${file}, Hash: ${hash}, Rtype=17, PPID=4000, Result: ${result}`)
  const reasons = (file: string) =>
    `Blocking Reasons: Hash: ${hash} not found in the database, Path: ${file} not found in Path Exclusion, Publisher: Not Signed not found in Publisher Exclusion, Parent Process: C:\\Windows\\explorer.exe not found in Process Exclusion`

  it('splits time, kind, thread and message, reading the date month first', () => {
    const [entry] = parseLog(w('01/05/2026 2:40:22 PM', 'INFO', 1234, 'Proxy not configured'))
    expect(entry.time?.getTime()).toBe(new Date(2026, 0, 5, 14, 40, 22).getTime())
    expect(entry.timeStr).toBe('01/05/2026 2:40:22 PM')
    expect(entry.level).toBe('INFO')
    expect(entry.message).toBe('[1234] Proxy not configured')
  })

  it('reads every date day first when one line in the file can only be day first', () => {
    const entries = parseLog([
      w('05/01/2026 2:40:22 PM', 'INFO', 1, 'first'),
      w('13/01/2026 2:40:22 PM', 'INFO', 1, 'second'),
    ].join('\r\n'))
    expect(entries.map(e => e.time?.getTime())).toEqual([
      new Date(2026, 0, 5, 14, 40, 22).getTime(),
      new Date(2026, 0, 13, 14, 40, 22).getTime(),
    ])
  })

  it('maps the kind to a level', () => {
    const entries = parseLog([
      w('01/13/2026 9:00:00 AM', 'WARNING', 1, 'Interop PID: 1234'),
      w('01/13/2026 9:00:00 AM', 'ERROR', 1, 'AutoUpdate ~ Installer agent download failed'),
      w('01/13/2026 9:00:00 AM', 'DEBUG', 1, 'ScanHash result: 5'),
      w('01/13/2026 9:00:00 AM', 'FILE PRE-CHECK', 1, 'Filename: C:\\Tools\\a.exe, FileType: 17, Parent: C:\\Windows\\explorer.exe, GrandParent: C:\\Windows\\System32\\userinit.exe, User: tester'),
    ].join('\r\n'))
    expect(entries.map(e => e.level)).toEqual(['WARN', 'ERROR', 'DEBUG', 'DEBUG'])
    expect(entries[3].source).toBe('FILE PRE-CHECK')
    expect(entries[3].message.startsWith('FILE PRE-CHECK [1] Filename: C:\\Tools\\a.exe, FileType: 17')).toBe(true)
  })

  it('takes the FILE CHECK level from the result, not from words in the path', () => {
    const entries = parseLog([
      check('C:\\Tools\\Debug\\Blocker\\error.dll', 'Allowing file to run - Trusted Publisher Execution'),
      check('C:\\Tools\\a.exe', '(CACHED) Blocking File - Blocked Execution'),
      check('C:\\Tools\\a.exe', 'Blocking File - Untrusted Execution [Audit]'),
      check('C:\\Tools\\run.ps1', 'Blocking File - Constrained Execution'),
    ].join('\r\n'))
    expect(entries.map(e => e.level)).toEqual(['INFO', 'ERROR', 'WARN', 'WARN'])
    expect(entries[0].source).toBe('FILE CHECK')
    expect(entries[0].message).toBe(`FILE CHECK [300] Filename: C:\\Tools\\Debug\\Blocker\\error.dll, Hash: ${hash}, Rtype=17, PPID=4000, Result: Allowing file to run - Trusted Publisher Execution`)
  })

  it('joins the Blocking Reasons line to its FILE CHECK', () => {
    const entries = parseLog([
      check('C:\\Tools\\a.exe', 'Blocking File - Blocked Execution'),
      reasons('C:\\Tools\\a.exe'),
      w('01/13/2026 9:00:04 AM', 'INFO', 300, 'Deleting memory for tester groups count: 14, PID: 4000'),
    ].join('\r\n'))
    expect(entries).toHaveLength(2)
    expect(entries[0].level).toBe('ERROR')
    expect(entries[0].message.split('\n')[1]).toBe(reasons('C:\\Tools\\a.exe'))
  })

  it('marks a blocked browser extension as an error, and as a warning in audit mode', () => {
    const ext = (result: string) => w('01/13/2026 9:00:05 AM', 'INFO', 7, `[EXT-BLOCK] Extension Title: Example Helper, Hash: ${hash}, Extension Folder: \\Users\\tester\\Extensions\\abc, Extension Path: C:\\Temp\\abc_1.crx, Browser: Microsoft Edge, Result: ${result}`)
    const entries = parseLog([
      ext('Blocking Extension - Blocked Execution'),
      ext('Blocking Extension - Untrusted Execution [Audit]'),
    ].join('\r\n'))
    expect(entries.map(e => e.level)).toEqual(['ERROR', 'WARN'])
    expect(entries[0].message.startsWith('[7] [EXT-BLOCK] Extension Title: Example Helper')).toBe(true)
  })

  it('keeps tabs inside a message and skips the blank line the agent writes after it', () => {
    const entries = parseLog([
      w('01/13/2026 9:00:06 AM', 'DEBUG', 9, 'Airlock AppX EVT authority reconcile activeActivities=0\t desiredPid=0\t authorizedPid=0\t ambiguous='),
      '',
      w('01/13/2026 9:00:06 AM', 'INFO', 9, 'Cache cleared!'),
    ].join('\r\n'))
    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe('[9] Airlock AppX EVT authority reconcile activeActivities=0\t desiredPid=0\t authorizedPid=0\t ambiguous=')
  })
})

describe('parseLog: Airlock server logs', () => {
  it('parses Go service lines and keeps file:line in the message', () => {
    const entries = parseLog([
      '2026/01/05 10:00:00 service.go:120: POST /api/submitfile from ip: 10.0.0.5 hostname: host-a',
      '2026/01/05 10:00:01 main.go:50: ERROR: Cannot connect to cache',
    ].join('\n'))
    expect(entries[0].time?.getTime()).toBe(new Date(2026, 0, 5, 10, 0, 0).getTime())
    expect(entries[0].source).toBe('service.go:120')
    expect(entries[0].message).toBe('service.go:120: POST /api/submitfile from ip: 10.0.0.5 hostname: host-a')
    expect(entries.map(e => e.level)).toEqual(['INFO', 'ERROR'])
  })

  it('parses bracketed timestamps with and without a tag', () => {
    const entries = parseLog([
      '[2026-01-05 10:00:10] [LogMailer] Network error for \'\': connection refused',
      '[2026-01-05T10:00:11+10:00] Running index health check',
    ].join('\n'))
    expect(entries[0].time?.getTime()).toBe(new Date(2026, 0, 5, 10, 0, 10).getTime())
    expect(entries[0].source).toBe('LogMailer')
    expect(entries[0].level).toBe('ERROR')
    expect(entries[0].message).toBe("[LogMailer] Network error for '': connection refused")
    expect(entries[1].time?.toISOString()).toBe('2026-01-05T00:00:11.000Z')
    expect(entries[1].message).toBe('Running index health check')
  })

  it('parses server activity lines as day/month/year', () => {
    const [entry] = parseLog('ServerActivityMessage|05/01/2026 02:40:22 PM|Login|admin|User: admin logged in successfully')
    expect(entry.time?.getTime()).toBe(new Date(2026, 0, 5, 14, 40, 22).getTime())
    expect(entry.source).toBe('Login')
    expect(entry.message).toBe('Login | admin | User: admin logged in successfully')
  })

  it('parses Passenger lines', () => {
    const [entry] = parseLog('[ W 2026-01-05 10:00:10.0785 4321/T1 age/Cor/Example.cpp:10 ]: Something looks off')
    expect(entry.time?.getTime()).toBe(new Date(2026, 0, 5, 10, 0, 10, 78).getTime())
    expect(entry.level).toBe('WARN')
    expect(entry.message).toBe('age/Cor/Example.cpp:10: Something looks off')
  })

  it('parses date(1) style startup lines', () => {
    const [entry] = parseLog('Mon Jan  5 08:00:00 AEDT 2026 - starting up')
    expect(entry.time?.getTime()).toBe(new Date(2026, 0, 5, 8, 0, 0).getTime())
    expect(entry.message).toBe('starting up')
  })

  it('parses ISO timestamps whose offset has no colon', () => {
    const [entry] = parseLog('2026-01-05T10:29:15.123+1000\tfinished restoring airlock.things (3 documents, 0 failures)')
    expect(entry.time?.toISOString()).toBe('2026-01-05T00:29:15.123Z')
  })

  it('keeps resque job lines, which have no timestamp, as separate rows', () => {
    const entries = parseLog([
      '*** got: (Job{addexe} | AddExe | ["/tmp/a.addexe"])',
      '*** done: (Job{addexe} | AddExe | ["/tmp/a.addexe"])',
    ].join('\n'))
    expect(entries).toHaveLength(2)
    expect(entries[0].time).toBeNull()
    expect(entries[1].message).toBe('*** done: (Job{addexe} | AddExe | ["/tmp/a.addexe"])')
  })

  it('does not drop lines that come before the first timestamp', () => {
    const entries = parseLog([
      '=====[ cleanupdb]=====',
      'done.',
      '2026-01-05 10:00:00 INFO started',
      '  continuation',
    ].join('\n'))
    expect(entries.map(e => e.message)).toEqual(['=====[ cleanupdb]=====', 'done.', 'started\n  continuation'])
  })
})
