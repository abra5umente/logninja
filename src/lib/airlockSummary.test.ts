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

// A made-up Windows agent debug log in the 7.x tab-separated format. Nothing here is copied from a real system.
const W_CLIENT = '99999999-2222-3333-4444-555555555555'
const W_POLICY = 'ffffffff-0000-0000-0000-000000000009'
const W_DB = 'C:\\Program Files (x86)\\Airlock Digital\\Airlock Digital Client\\db'
const EXT_ID = 'abcdefghijklmnop'.repeat(2)
const w = (time: string, kind: string, thread: number, msg: string) => `01/13/2026 ${time}\t${kind}\t${thread}\t${msg}`
const winCheck = (time: string, file: string, result: string, rtype = 17) =>
  w(time, 'FILE CHECK', 300, `Filename: ${file}, Hash: ${h('ab')}, Rtype=${rtype}, PPID=4000, Result: ${result}`)
const winPreCheck = (time: string, file: string, parent: string, user: string) =>
  w(time, 'FILE PRE-CHECK', 300, `Filename: ${file}, FileType: 17, Parent: ${parent}, GrandParent: C:\\Windows\\System32\\userinit.exe, User: ${user}, Hash: ${h('ab')}, Publisher: Not Signed`)
const winReasons = (file: string, publisher: string, parent: string) =>
  `Blocking Reasons: Hash: ${h('ab')} not found in the database, Path: ${file} not found in Path Exclusion, Publisher: ${publisher} not found in Publisher Exclusion, Parent Process: ${parent} not found in Process Exclusion`
const SYS_DLL = 'C:\\Windows\\System32\\Debug\\info.dll'
const TOOL = 'C:\\Users\\tester\\Desktop\\tool.exe'
const SCRIPT = 'C:\\Users\\tester\\Desktop\\run.ps1'
const HELPER = 'C:\\Program Files\\Example\\helper.dll'
const POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const EXPLORER = 'C:\\Windows\\explorer.exe'

const WIN_LOG = [
  w('9:00:00 AM', 'INFO', 100, 'Starting Airlock Enforcement Agent (v7.0.1.0) on Windows 11 x64 (Release: 24H2)'),
  w('9:00:00 AM', 'INFO', 100, 'Computer Name: LAB-WIN-01, SysPrepHostname: '),
  w('9:00:00 AM', 'DEBUG', 100, `[EXT-BLOCK] Allowed synced Microsoft Edge extension on initialization: ${EXT_ID}`),
  w('9:00:01 AM', 'INFO', 100, 'Proxy not configured'),
  w('9:00:01 AM', 'INFO', 100, 'Configuration ~ Primary Airlock Server ~ airlock.example'),
  w('9:00:01 AM', 'INFO', 100, 'Configuration ~ Primary Airlock Server ~ 10.0.0.9 (fallback)'),
  w('9:00:01 AM', 'WARNING', 100, "Example Antivirus Interop Detection: found!...let's be friendly with it"),
  w('9:00:01 AM', 'WARNING', 100, 'Interop PID: 1234'),
  w('9:00:02 AM', 'INFO', 100, `Opening Policy database: ${W_DB}\\${W_CLIENT}.db`),
  w('9:00:02 AM', 'INFO', 100, `Policy version retrieval - Policy DB: ${W_DB}\\${W_CLIENT}.db Policy Version: 40`),
  w('9:00:02 AM', 'INFO', 100, 'Auditmode: true'),
  w('9:00:02 AM', 'INFO', 100, 'AutoUpdate: true'),
  w('9:00:02 AM', 'DEBUG', 100, '[CONSTRAINED-MODE] Setting Powershell Language Mode to default...'),
  w('9:00:02 AM', 'INFO', 100, 'Adding File Extension: ps1'),
  w('9:00:02 AM', 'INFO', 100, 'Adding File Extension: bat'),
  w('9:00:02 AM', 'DEBUG', 100, 'Extension Blocking is enabled for audit'),
  w('9:00:02 AM', 'INFO', 100, 'Assembly Reflection: ON'),
  w('9:00:02 AM', 'INFO', 100, 'Self Service enabled for all'),
  w('9:00:02 AM', 'INFO', 100, 'Aggressive Boot is enabled'),
  w('9:00:03 AM', 'INFO', 100, `Current hash database version verified: 7 for ${W_DB}\\${W_POLICY}.db`),
  w('9:00:03 AM', 'INFO', 100, `Initializing Hash database: ${W_DB}\\${W_POLICY}.db`),
  w('9:00:03 AM', 'INFO', 100, 'AutoElevate: false'),
  w('9:00:03 AM', 'INFO', 100, 'Connecting to the filter ...'),
  w('9:00:03 AM', 'INFO', 101, 'Sent Signal for Kernel to start'),
  w('9:00:03 AM', 'INFO', 102, 'Local IP: 10.0.0.21'),
  w('9:00:04 AM', 'INFO', 200, 'Check In ~ Report Status ~ Reporting agent status to server'),
  w('9:00:04 AM', 'INFO', 200, 'Establish Connection ~ Connect ~ Trying to connect to POST: airlock.example:443 endpoint: /api/checkin'),
  w('9:00:04 AM', 'INFO', 200, 'Establish Connection ~ Connect ~ Request: /api/checkin'),
  w('9:00:04 AM', 'INFO', 200, 'Establish Connection ~ Connect ~ airlock.example contacted successfully on port 443'),
  w('9:00:04 AM', 'INFO', 200, 'AutoUpdate ~ Current Version: 7.0.1.0 Target Version: 7.0.0.0'),
  w('9:00:04 AM', 'ERROR', 200, 'Establish Connection ~ Connect Error Details ~ Request: /api/getclient failed with HTTP response code: 400 (Database does not exist on the server)'),
  w('9:00:04 AM', 'ERROR', 200, 'AutoUpdate ~ Installer agent download failed'),
  w('9:00:04 AM', 'INFO', 200, 'Check In ~ Policy Update ~ Checking for new policy version the current version is 40'),
  w('9:00:04 AM', 'INFO', 200, 'Check In ~ Policy Update ~ Policy is up to date'),
  w('9:01:00 AM', 'DEBUG', 300, `Processing file: ${SYS_DLL}`),
  w('9:01:00 AM', 'FILE PRE-CHECK', 300, `Filename: ${SYS_DLL}, FileType: 13, Parent: ${EXPLORER}, GrandParent: C:\\Windows\\System32\\userinit.exe, User: tester`),
  w('9:01:00 AM', 'DEBUG', 300, `Filename: ${SYS_DLL} start blocklist processing...`),
  w('9:01:00 AM', 'DEBUG', 300, 'ScanHash result: 5'),
  w('9:01:00 AM', 'DEBUG', 300, `Responding to Kernel ~ Filename: ${SYS_DLL}, Result: ALLOW`),
  w('9:01:00 AM', 'DEBUG', 300, `Responding to Kernel ~ Filename: ${SYS_DLL} ~ SUCCESS`),
  winCheck('9:01:00 AM', SYS_DLL, 'Allowing file to run - Trusted Publisher Execution', 13),
  winCheck('9:01:01 AM', SYS_DLL, '(CACHED) Allowing file to run - Trusted Publisher Execution', 13),
  winCheck('9:01:02 AM', SYS_DLL, '(CACHED) Allowing file to run - Trusted Execution', 13),
  w('9:01:02 AM', 'DEBUG', 300, 'Airlock AppX EVT authority reconcile activeActivities=0\t desiredPid=0\t authorizedPid=0\t ambiguous='),
  '',
  w('9:01:02 AM', 'INFO', 300, 'Deleting memory for tester groups count: 14, PID: 4000'),
  w('9:05:00 AM', 'INFO', 200, 'Check In ~ Policy Update ~ There is a new policy version available 41'),
  w('9:05:00 AM', 'INFO', 200, 'Auditmode: false'),
  w('9:05:00 AM', 'INFO', 200, 'AutoUpdate: false'),
  w('9:05:00 AM', 'INFO', 200, 'Self Service is disabled'),
  w('9:05:00 AM', 'INFO', 200, 'Aggressive Boot was successfully disabled'),
  w('9:05:00 AM', 'INFO', 200, 'Check In ~ Policy Update ~ New policy version applied successfully, version is now 41'),
  winPreCheck('9:06:00 AM', TOOL, POWERSHELL, 'tester'),
  w('9:06:00 AM', 'DEBUG', 300, `Responding to Kernel ~ Filename: ${TOOL}, Result: BLOCK`),
  winCheck('9:06:00 AM', TOOL, 'Blocking File - Blocked Execution'),
  winReasons(TOOL, 'Not Signed', POWERSHELL),
  winCheck('9:06:01 AM', TOOL, '(CACHED) Blocking File - Blocked Execution', 500),
  winReasons(TOOL, 'Not Signed', POWERSHELL),
  winCheck('9:06:02 AM', SCRIPT, 'Blocking File - Blocked Execution', 14),
  winReasons(SCRIPT, 'Not Signed', POWERSHELL),
  winPreCheck('9:06:03 AM', HELPER, EXPLORER, 'SYSTEM'),
  winCheck('9:06:03 AM', HELPER, 'Blocking File - Blocked Execution', 13),
  winReasons(HELPER, 'Example Software GmbH', EXPLORER),
  w('9:06:04 AM', 'INFO', 400, `Client Activities ~ Uploading Events ~ Submitting untrusted file: ${TOOL} rowid: 1`),
  w('9:07:00 AM', 'DEBUG', 300, `[EXT-BLOCK] Processing crx file: \\Users\\tester\\AppData\\Local\\Temp\\scoped_dir1_2\\${EXT_ID}_1.crx`),
  w('9:07:00 AM', 'INFO', 300, `[EXT-BLOCK] Extension Title: Example Helper, Hash: ${h('cd')}, Extension Folder: \\Users\\tester\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Extensions\\${EXT_ID}, Extension Path: C:\\Users\\tester\\AppData\\Local\\Temp\\scoped_dir1_2\\${EXT_ID}_1.crx, Browser: Microsoft Edge, Result: Blocking Extension - Blocked Execution`),
  w('9:07:01 AM', 'INFO', 500, 'Client Activities ~ Uploading Extension Events ~ Submitting untrusted extension: Example Helper rowid: 1'),
  w('9:08:00 AM', 'INFO', 200, 'Current Stats ~ Virtual Memory: 10485760 Physical Memory: 31457280 Handles: 300'),
  w('9:09:00 AM', 'INFO', 600, 'Worker Thread exit - success!'),
  w('9:09:01 AM', 'INFO', 100, 'Airlock Digital - Closed!'),
].join('\r\n')

describe('extractAirlockSummary: Windows 7.x agent debug log', () => {
  const s = extractAirlockSummary(WIN_LOG)

  it('reads agent and host details', () => {
    expect(s['Airlock Version']).toBe('7.0.1.0')
    expect(s['Agent Starts']).toBe('1')
    expect(s['Agent Stops']).toBe('1')
    expect(s['Debug Logging']).toBe('Yes (11 debug lines)')
    expect(s['Log Period']).toBe('01/13/2026 9:00:00 AM to 01/13/2026 9:09:01 AM')
    expect(s['Errors and Warnings']).toBe('2 errors, 2 warnings')
    expect(s['Agent Memory']).toBe('30.0 MB physical, 10.0 MB virtual, 300 handles')
    expect(s['Kernel Mode']).toBe('Filter driver started')
    expect(s['AutoUpdate Enabled']).toBe('False (previously True)')
    expect(s['Server Agent Version']).toBe('7.0.0.0 (agent is 7.0.1.0)')
    expect(s['Computer Name']).toBe('LAB-WIN-01')
    expect(s['Operating System']).toBe('Windows 11 x64 (Release: 24H2)')
    expect(s['Local IP Address']).toBe('10.0.0.21')
  })

  it('reads the server connection', () => {
    expect(s['Primary Airlock Server']).toBe('airlock.example')
    expect(s['Fallback Server']).toBe('10.0.0.9')
    expect(s['Proxy Configured']).toBe('No')
    expect(s['Server Connections']).toBe('1 ok, 1 failed')
    expect(s['Check Ins']).toBe('1')
    expect(s['Client Id']).toBe(W_CLIENT)
  })

  it('reports the latest policy state and what it changed from', () => {
    expect(s['Policy DB Loaded']).toBe('Yes')
    expect(s['Policy DB Version']).toBe('41 (previously 40)')
    expect(s['Hash DB Version']).toBe('7')
    expect(s['Policy Id']).toBe(W_POLICY)
    expect(s['Policy Updates']).toBe('1')
    expect(s['Audit Mode']).toBe('No (changed from Yes at 01/13/2026 9:05:00 AM)')
    expect(s['Self Service Enabled']).toBe('No (previously Yes (all))')
    expect(s['Powershell Constrained Mode']).toBe('default')
    expect(s['Assembly Reflection Enabled']).toBe('Yes')
    expect(s['Extension Blocking']).toBe('Enabled for audit (logged at 01/13/2026 9:00:02 AM)')
    expect(s['Aggressive Boot']).toBe('No (previously Yes)')
    expect(s['Auto Elevate']).toBe('No')
    expect(s['File Extensions Added']).toBe('2')
    expect(s['Interops Found']).toBe('Example Antivirus')
  })

  it('counts allowed and blocked executions and blocked browser extensions', () => {
    expect(s['Execution Count']).toBe('7')
    expect(s['Allowed Executions']).toBe('3')
    expect(s['Blocked Executions']).toBe('4')
    expect(s['Audit Blocks']).toBe('0')
    expect(s['Execution Results']).toBe([
      'Blocking File - Blocked Execution (4)',
      'Allowing file to run - Trusted Publisher Execution (2)',
      'Allowing file to run - Trusted Execution (1)',
    ].join('\n'))
    expect(s['Top Executed File']).toBe(`${SYS_DLL} (3)`)
    expect(s['Top Blocked File']).toBe(`${TOOL} (2)`)
    expect(s['Top Blocked Parent']).toBe(`${POWERSHELL} (3)`)
    expect(s['Top Blocked Publisher']).toBe('Not Signed (3)')
    expect(s['Users Seen']).toBe('tester, SYSTEM')
    expect(s['Blocked Browser Extensions']).toBe('Example Helper, Microsoft Edge (1)')
    expect(s['Untrusted Files Submitted']).toBe('1')
  })

  it('gives every filled-in field a search that finds rows in the parsed log', () => {
    const rows = parseLog(WIN_LOG).map(e => `${e.timeStr} ${e.level} ${e.message}`)
    const hits = (key: (typeof AIRLOCK_FIELDS)[number]) => {
      const token = getAirlockFieldSearchString(key, s)
      const useRegex = key === 'Proxy Configured' || /^\(\?i\)/.test(token) || /[.*+?^${}()|[\]\\]/.test(token)
      const { re } = buildSearchRegex(token, useRegex)
      return re ? rows.filter(r => new RegExp(re.source, 'i').test(r)).length : 0
    }
    for (const key of AIRLOCK_FIELDS) {
      if (s[key] === '—' || s[key] === '0' || key === 'Log Period') continue
      expect(hits(key), key).toBeGreaterThan(0)
    }
    expect(hits('Debug Logging')).toBe(11)
    expect(hits('Errors and Warnings')).toBe(4)
    expect(hits('Execution Count')).toBe(7)
    expect(hits('Allowed Executions')).toBe(3)
    expect(hits('Blocked Executions')).toBe(4)
    expect(hits('Top Executed File')).toBe(3)
    expect(hits('Top Blocked File')).toBe(2)
    expect(hits('Top Blocked Parent')).toBe(3)
    expect(hits('Top Blocked Publisher')).toBe(3)
    expect(hits('Blocked Browser Extensions')).toBe(1)
    expect(hits('Untrusted Files Submitted')).toBe(1)
  })

  it('leaves the fields only the Linux agent logs empty', () => {
    for (const key of ['Agent PID', 'Agent Hash', 'RPC', 'Kernel', 'CPU Cores', 'Machine Id', 'Packages Indexed', 'Mountpoints Monitored', 'Policy Group', 'Safe Mode'] as const) {
      expect(s[key], key).toBe('—')
    }
  })
})

describe('extractAirlockSummary: other logs', () => {
  it('still reads an older Windows agent line', () => {
    const s = extractAirlockSummary('08/13/2025 9:15:30 AM\tINFO\t12\tFound Publisher: Example Corp')
    expect(s['Publishers Loaded']).toBe('1')
    expect(s['Debug Logging']).toBe('No')
    expect(s['Errors and Warnings']).toBe('0 errors, 0 warnings')
    expect(s['Execution Count']).toBe('—')
  })

  it('leaves the newer fields empty when there are no agent lines at all', () => {
    const s = extractAirlockSummary('Version: 1.2.3\nsomething else entirely')
    expect(s['Debug Logging']).toBe('—')
    expect(s['Errors and Warnings']).toBe('—')
    expect(s['Execution Count']).toBe('—')
    expect(s['Blocked Browser Extensions']).toBe('—')
  })
})
