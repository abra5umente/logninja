import { describe, expect, it } from 'vitest'
import { AIRLOCK_FIELDS, extractAirlockSummary, getAirlockFieldSearchString, isAirlockDebugFileName } from './airlockSummary'
import { parseLog } from './parse'
import { buildSearchRegex } from './search'

// A made-up Linux agent debug log in the 7.x line format. Hosts, ids, hashes and names are invented;
// nothing here is copied from a real system.
const h = (c: string) => c.repeat(32)
const CLIENT = '11111111-2222-3333-4444-555555555555'
const POLICY_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const POLICY_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const blocked = (ts: string, file: string, result: string, parent: string, publisher: string) =>
  `${ts} FILE CHECK Filename=${file} Hash="${h('ab')} not found in the database" Type=1 Result="${result}" Blocking Reasons==> GrandParent="/usr/sbin/sshd not found in Process Exclusion" Parent="${parent} not found in Process Exclusion" Path="${file} not found in Path Exclusions" Publisher="${publisher} not found in Publisher Exclusions"`

const LOG = [
  '2026-01-05 10:00:01 INFO  ================================================================================',
  '2026-01-05 10:00:01 INFO  Starting Airlock Enforcement Agent (v7.0.1.1234-abcdef0)',
  '2026-01-05 10:00:01 INFO  MAXPROCS (default) = 2',
  '',
  '2026-01-05 10:00:01 INFO  RPC communication: Secured',
  '2026-01-05 10:00:01 INFO  RPC communication at port 1125',
  '2026-01-05 10:00:02 INFO  Airlock PID: 4242',
  '2026-01-05 10:00:02 ERROR [/build/agent/airlock/info.go:10] could not read user ids: exit status 2',
  `2026-01-05 10:00:02 INFO  AirlockHash: ${h('0f')}`,
  '2026-01-05 10:00:03 INFO  OS: Example Linux 1.2 LTS',
  '2026-01-05 10:00:03 INFO  Kernel: 6.1.0-test',
  '2026-01-05 10:00:03 INFO  CPU Core Count: 2',
  '2026-01-05 10:00:03 INFO  Computer Name: lab-host.example',
  '2026-01-05 10:00:03 INFO  Logged User: tester (UID: 1001)',
  '2026-01-05 10:00:03 INFO  Local IP Address: 10.0.0.5',
  `2026-01-05 10:00:03 INFO  Machine Id: ${h('1e')}`,
  '2026-01-05 10:00:03 INFO  Linux: Debian-based',
  '2026-01-05 10:00:04 INFO  Refreshing package: alpha.1.0',
  '2026-01-05 10:00:04 INFO  Refreshing package: beta.2.0',
  '2026-01-05 10:00:04 INFO  Refreshing package: gamma.3.0',
  '2026-01-05 10:00:05 ERROR [/build/agent/airlock/settings.go:20] Establish Connection ~ Connect ~  unable to connect on port  using IP Address Fallback',
  '2026-01-05 10:00:05 ERROR [/build/agent/airlock/driver.go:30] Error loading kernel driver: exit status 1 Output: ',
  '2026-01-05 10:00:05 INFO  Configuration ~ Primary Airlock Server ~ airlock.example',
  '2026-01-05 10:00:05 INFO  Configuration ~ Primary Airlock Server ~ 10.0.0.9 (fallback)',
  '2026-01-05 10:00:05 INFO  Proxy not configured (XML)',
  '2026-01-05 10:00:05 INFO  Relay Count = 0',
  `2026-01-05 10:00:05 INFO  Init Policy: /etc/airlock/db/${CLIENT}.db, /etc/airlock/db/${POLICY_A}.db`,
  '2026-01-05 10:00:06 INFO  Adding File Extension: sh',
  '2026-01-05 10:00:06 INFO  Adding File Extension: py',
  '2026-01-05 10:00:06 INFO  Auditmode: true',
  '2026-01-05 10:00:06 INFO  Self Service is disabled',
  '2026-01-05 10:00:06 INFO  Relay Mode = ',
  '2026-01-05 10:00:06 INFO  Current hash database version verified: 55',
  '2026-01-05 10:00:07 INFO  Check In ~ Report Status ~ Reporting agent status to server',
  '2026-01-05 10:00:07 INFO  Launching FANotify...',
  '2026-01-05 10:00:07 INFO  FANotify launched',
  '2026-01-05 10:00:07 INFO  Adding marks to mountpoint: /run',
  '2026-01-05 10:00:07 INFO  Adding marks to mountpoint: /dev/shm',
  '2026-01-05 10:00:07 INFO  AutoUpdate: Version available in Server - 7.0.0.1000, Current version: 7.0.1.1234',
  '2026-01-05 10:00:07 WARN  [/build/agent/airlock/api.go:40] request failed on attempt 1/3, retrying',
  '2026-01-05 10:00:08 INFO  Establish Connection ~ Connect ~ airlock.example contacted successfully on port 443',
  '2026-01-05 10:00:08 INFO  Check In ~ Policy Update ~ Checking for new policy version the current version is 79',
  '2026-01-05 10:00:08 INFO  Check In ~ Policy Update ~ Policy is up to date',
  blocked('2026-01-05 10:01:00', '/opt/tools/run.sh', 'Blocking File - Untrusted Execution [Audit]', '/usr/bin/bash', 'Not Signed'),
  blocked('2026-01-05 10:01:01', '/opt/tools/run.sh', '(CACHED) Blocking File - Untrusted Execution [Audit]', '/usr/bin/bash', 'Not Signed'),
  '2026-01-05 10:02:00 INFO  Loading Policy Settings...',
  '2026-01-05 10:02:00 INFO  Debug Logging is now enabled',
  '2026-01-05 10:02:01 DEBUG PCACHE: [Filename=/usr/bin/cat, pid=501, ppid=500, modtime=1:2:3, Result=NotFound(NewAdd)]',
  '2026-01-05 10:02:01 DEBUG Interop paths exist - checking',
  '2026-01-05 10:02:01 DEBUG HandleFanotifyEvent:: [EXEC /usr/bin/cat]',
  '2026-01-05 10:02:01 DEBUG Username - tester = 1001',
  '2026-01-05 10:02:01 DEBUG CheckBlocklist: [Checking blocklist database]',
  `2026-01-05 10:02:01 DEBUG CheckBlocklistMetaRule: [Filename:  cat Package: 100 Metarule: block example [ ${POLICY_A.replace('aaaaaaaa', 'cccccccc')} ] Rule Check: path match /usr/bin/example]`,
  `2026-01-05 10:02:01 DEBUG CheckAllowMetaRule: [Filename:  cat Package: 101 Metarule: allow one [ ${POLICY_A.replace('aaaaaaaa', 'dddddddd')} ] Rule Check: path match /opt/one/test.bin]`,
  `2026-01-05 10:02:01 DEBUG CheckAllowMetaRule: [Filename:  cat Package: 102 Metarule: allow two [ ${POLICY_A.replace('aaaaaaaa', 'eeeeeeee')} ] Rule Check: path match /opt/two/test.bin]`,
  `2026-01-05 10:02:01 DEBUG CheckAllowMetaRule: [Filename:  cat Package: 101 Metarule: allow one [ ${POLICY_A.replace('aaaaaaaa', 'dddddddd')} ] Rule Check: path match /opt/one/test.bin]`,
  '2026-01-05 10:02:01 DEBUG GetMode: [AUDIT]',
  '2026-01-05 10:02:01 DEBUG TRUSTED: [/usr/bin/cat]',
  `2026-01-05 10:02:01 FILE CHECK Filename=/usr/bin/cat Hash=${h('cd')} Type=5 Result="Allowing file to run - Trusted Publisher Execution"`,
  `2026-01-05 10:02:02 FILE CHECK Filename=/usr/bin/cat Hash=${h('cd')} Type=5 Result="(CACHED) Allowing file to run - Trusted Publisher Execution"`,
  `2026-01-05 10:02:02 FILE CHECK Filename=/usr/bin/dash Hash=${h('ef')} Type=0 Result="(CACHED) Allowing file to run - Trusted Execution"`,
  '2026-01-05 10:02:02 FILE CHECK Filename="Interop-/usr/bin/head (Type 20)"',
  '2026-01-05 10:03:00 DEBUG RPC: [UpdatePolicy]',
  `2026-01-05 10:03:00 INFO  Check In ~ Policy Update ~ Client was moved to a new policy with policyid: ${POLICY_B}`,
  `2026-01-05 10:03:00 DEBUG GetAPI: [/api/gethashdb/${CLIENT} /etc/airlock/db/tmphashdb]`,
  '2026-01-05 10:03:01 INFO  Auditmode: false',
  '2026-01-05 10:03:02 INFO  Check In ~ Hash DB Update ~ New hash database version applied successfully, version is now 9',
  '2026-01-05 10:03:02 INFO  Check In ~ Policy Update ~ New policy version applied successfully, version is now 16',
  '2026-01-05 10:03:04 INFO  RPC: GetAgentInfo: Server:"airlock.example"  ClientVersion:"7.0.1.1234-abcdef0"  PolicyVersion:"v16.9"  GroupParent:"Lab"  GroupName:"Linux Test"  PolicyId:"' + POLICY_B + '"  Mode:EnforcementMode  AuditMode:false  DebugMode:true  OnlineStatus:ONLINE',
  '2026-01-05 10:03:05 DEBUG Username - svc = 5000',
  '2026-01-05 10:03:05 DEBUG BLOCKED: [/usr/bin/ps]',
  '2026-01-05 10:03:05 DEBUG ES Notify message: [ps has been prevented from executing as a result of Allowlisting.]',
  blocked('2026-01-05 10:03:05', '/usr/bin/ps', 'Blocking File - Blocked Execution', '/opt/app/worker', 'Not Signed'),
  blocked('2026-01-05 10:03:06', '/usr/bin/ps', '(CACHED) Blocking File - Blocked Execution', '/opt/app/worker', 'Example Signer <signer@example.com>'),
  blocked('2026-01-05 10:03:07', '/usr/bin/ps', '(CACHED) Blocking File - Blocked Execution', '/opt/app/worker', 'Not Signed'),
  '2026-01-05 10:04:00 INFO  Clearing fanotify marks...',
  '2026-01-05 10:04:00 INFO  Closing fanotify...',
  '2026-01-05 10:04:10 INFO  Starting Airlock Enforcement Agent (v7.0.1.1234-abcdef0)',
  '2026-01-05 10:04:11 ERROR [/build/agent/airlock/policy.go:50] Policy database seems corrupted...deleting! Setting to Safe Mode.',
].join('\n')

describe('isAirlockDebugFileName', () => {
  it('recognises agent log names', () => {
    expect(isAirlockDebugFileName('AirlockEnforcementAgentCore.log')).toBe(true)
    expect(isAirlockDebugFileName('airlock.0.log')).toBe(true)
    expect(isAirlockDebugFileName('rails.log')).toBe(false)
  })
})

describe('extractAirlockSummary: Linux 7.x agent debug log', () => {
  const s = extractAirlockSummary(LOG)

  it('reads agent and host details', () => {
    expect(s['Airlock Version']).toBe('7.0.1.1234-abcdef0')
    expect(s['Agent Starts']).toBe('2')
    expect(s['Agent Stops']).toBe('1')
    expect(s['Debug Logging']).toBe('Yes (16 debug lines)')
    expect(s['Log Period']).toBe('2026-01-05 10:00:01 to 2026-01-05 10:04:11')
    expect(s['Errors and Warnings']).toBe('4 errors, 1 warnings')
    expect(s['Agent PID']).toBe('4242')
    expect(s['Agent Hash']).toBe(h('0f'))
    expect(s['Kernel Mode']).toBe('FANotify (kernel driver did not load)')
    expect(s['RPC']).toBe('Secured, port 1125')
    expect(s['Server Agent Version']).toBe('7.0.0.1000 (agent is 7.0.1.1234)')
    expect(s['Computer Name']).toBe('lab-host.example')
    expect(s['Operating System']).toBe('Example Linux 1.2 LTS (Debian-based)')
    expect(s['Kernel']).toBe('6.1.0-test')
    expect(s['CPU Cores']).toBe('2')
    expect(s['Logged User']).toBe('tester (UID: 1001)')
    expect(s['Local IP Address']).toBe('10.0.0.5')
    expect(s['Machine Id']).toBe(h('1e'))
    expect(s['Packages Indexed']).toBe('3')
    expect(s['Mountpoints Monitored']).toBe('2')
  })

  it('dates an audit mode change by the switch, not by later lines repeating the value', () => {
    const s2 = extractAirlockSummary([
      '2026-01-05 10:00:00 INFO  Auditmode: false',
      '2026-01-05 11:00:00 INFO  Auditmode: true',
      '2026-01-05 12:00:00 INFO  Auditmode: true',
    ].join('\n'))
    expect(s2['Audit Mode']).toBe('Yes (changed from No at 2026-01-05 11:00:00)')
  })

  it('does not read "Version" in the AutoUpdate line as "on"', () => {
    expect(s['AutoUpdate Enabled']).toBe('—')
  })

  it('reads the server connection', () => {
    expect(s['Primary Airlock Server']).toBe('airlock.example')
    expect(s['Fallback Server']).toBe('10.0.0.9')
    expect(s['Proxy Configured']).toBe('No')
    expect(s['Relay']).toBe('0')
    expect(s['Server Connections']).toBe('1 ok, 1 failed')
    expect(s['Check Ins']).toBe('1')
    expect(s['Client Id']).toBe(CLIENT)
  })

  it('reports the latest policy state and what it changed from', () => {
    expect(s['Policy DB Loaded']).toBe('Yes')
    expect(s['Policy DB Version']).toBe('16 (previously 79)')
    expect(s['Hash DB Version']).toBe('9 (previously 55)')
    expect(s['Policy Id']).toBe(`${POLICY_B} (previously ${POLICY_A})`)
    expect(s['Policy Updates']).toBe('1')
    expect(s['Policy Group']).toBe('Lab / Linux Test')
    expect(s['Safe Mode']).toBe('Entered 1 time (last at 2026-01-05 10:04:11)')
    expect(s['Audit Mode']).toBe('No (changed from Yes at 2026-01-05 10:03:01)')
    expect(s['Self Service Enabled']).toBe('No')
    expect(s['File Extensions Added']).toBe('2')
    expect(s['Blocklist Metarules loaded']).toBe('1 (seen in rule checks)')
    expect(s['Allowlist Metarules loaded']).toBe('2 (seen in rule checks)')
  })

  it('counts allowed, blocked and audit-only executions', () => {
    expect(s['Execution Count']).toBe('8')
    expect(s['Allowed Executions']).toBe('3')
    expect(s['Blocked Executions']).toBe('3')
    expect(s['Audit Blocks']).toBe('2')
    expect(s['Execution Results']).toBe([
      'Blocking File - Blocked Execution (3)',
      'Blocking File - Untrusted Execution [Audit] (2)',
      'Allowing file to run - Trusted Publisher Execution (2)',
      'Allowing file to run - Trusted Execution (1)',
    ].join('\n'))
    expect(s['Top Executed File']).toBe('/usr/bin/ps (3)')
    expect(s['Top Blocked File']).toBe('/usr/bin/ps (3)')
    expect(s['Top Blocked Parent']).toBe('/opt/app/worker (3)')
    expect(s['Top Blocked Publisher']).toBe('Not Signed (4)')
    expect(s['Users Seen']).toBe('tester (UID 1001), svc (UID 5000)')
    expect(s['Interop Checks']).toBe('1')
    expect(s['Block Notifications']).toBe('1')
  })

  it('gives every filled-in field a search that finds rows in the parsed log', () => {
    const rows = parseLog(LOG).map(e => `${e.timeStr} ${e.level} ${e.message}`)
    const hits = (key: (typeof AIRLOCK_FIELDS)[number]) => {
      const token = getAirlockFieldSearchString(key, s)
      const useRegex = key === 'Proxy Configured' || /^\(\?i\)/.test(token) || /[.*+?^${}()|[\]\\]/.test(token)
      const { re } = buildSearchRegex(token, useRegex)
      return re ? rows.filter(r => new RegExp(re.source, 'i').test(r)).length : 0
    }
    for (const key of AIRLOCK_FIELDS) {
      if (s[key] === '—' || key === 'Log Period') continue
      expect(hits(key), key).toBeGreaterThan(0)
    }
    expect(hits('Execution Count')).toBe(8)
    expect(hits('Allowed Executions')).toBe(3)
    expect(hits('Blocked Executions')).toBe(3)
    expect(hits('Audit Blocks')).toBe(2)
    expect(hits('Top Blocked File')).toBe(3)
    expect(hits('Top Blocked Parent')).toBe(3)
    expect(hits('Top Blocked Publisher')).toBe(4)
    expect(hits('Errors and Warnings')).toBe(5)
  })
})

describe('extractAirlockSummary: other logs', () => {
  it('leaves the newer fields empty when there are no Linux agent lines', () => {
    const s = extractAirlockSummary('08/13/2025 9:15:30 AM\tINFO\t12\tFound Publisher: Example Corp')
    expect(s['Publishers Loaded']).toBe('1')
    expect(s['Debug Logging']).toBe('—')
    expect(s['Errors and Warnings']).toBe('—')
    expect(s['Execution Count']).toBe('—')
  })
})
