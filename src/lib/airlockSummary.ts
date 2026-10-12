// Airlock Debug Summary (browser): detect by filename and extract summary fields.
// Uses only the standard library.

// Fields are shown in this order, under these headings
export const AIRLOCK_FIELD_GROUPS = [
  {
    title: 'Agent',
    fields: [
      'Airlock Version',
      'Agent Starts',
      'Agent Stops',
      'Debug Logging',
      'Log Period',
      'Errors and Warnings',
      'Agent PID',
      'Agent Hash',
      'Agent Memory',
      'Kernel Mode',
      'RPC',
      'AutoUpdate Enabled',
      'Server Agent Version',
    ],
  },
  {
    title: 'Host',
    fields: [
      'Computer Name',
      'Operating System',
      'Kernel',
      'CPU Cores',
      'Logged User',
      'Local IP Address',
      'Machine Id',
      'Packages Indexed',
      'Mountpoints Monitored',
    ],
  },
  {
    title: 'Server connection',
    fields: [
      'Primary Airlock Server',
      'Fallback Server',
      'Proxy Configured',
      'Relay',
      'Server Connections',
      'Check Ins',
      'Client Id',
    ],
  },
  {
    title: 'Policy',
    fields: [
      'Policy DB Loaded',
      'Policy DB Version',
      'Hash DB Version',
      'Policy Id',
      'Policy Group',
      'Policy Updates',
      'Audit Mode',
      'Safe Mode',
      'Self Service Enabled',
      'Powershell Constrained Mode',
      'Assembly Reflection Enabled',
      'Extension Blocking',
      'Aggressive Boot',
      'Auto Elevate',
      'File Extensions Added',
      'Publishers Loaded',
      'Path Exclusions',
      'Parent Processes',
      'Blocklist Metarules loaded',
      'Allowlist Metarules loaded',
      'Allowlist Browser Extensions loaded',
      'Interops Found',
      'Interop Paths',
    ],
  },
  {
    title: 'Executions',
    fields: [
      'Execution Count',
      'Allowed Executions',
      'Blocked Executions',
      'Audit Blocks',
      'Constrained Executions',
      'Execution Results',
      'Top Executed File',
      'Top Blocked File',
      'Top Blocked Parent',
      'Top Blocked Publisher',
      'Users Seen',
      'Interop Checks',
      'Block Notifications',
      'Blocked Browser Extensions',
      'Untrusted Files Submitted',
    ],
  },
] as const

export type AirlockField = (typeof AIRLOCK_FIELD_GROUPS)[number]['fields'][number]

export const AIRLOCK_FIELDS: readonly AirlockField[] = AIRLOCK_FIELD_GROUPS.flatMap(g => [...g.fields])

export function isAirlockDebugFileName(name: string): boolean {
  // Match common Airlock debug log patterns, e.g.:
  // - airlock.log
  // - airlock.0.log, airlock.1.log
  // - airlock-debug-*.log
  // Keep it conservative to files that clearly include "airlock" in name.
  const base = name.toLowerCase()
  return /(^|\b)airlock[\w.-]*\.log$/.test(base)
}

function normalizeBool(v: string | null | undefined) {
  if (v == null) return v
  const s = String(v).trim().toLowerCase()
  if (["true","yes","on","enabled"].includes(s)) return 'Yes'
  if (["false","no","off","disabled"].includes(s)) return 'No'
  return v
}

function normalizeToTrueFalse(v: string | null | undefined): string | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  if (["true","yes","on","enabled"].includes(s)) return 'True'
  if (["false","no","off","disabled"].includes(s)) return 'False'
  return s ? s : null
}

function findFirst(lines: string[], regexes: RegExp[]) {
  for (const re of regexes) {
    for (const line of lines) {
      const m = line.match(re)
      if (m) return m
    }
  }
  return null
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function topOf(map: Map<string, number>): string | null {
  let top: string | null = null
  let max = 0
  for (const [k, c] of map) if (c > max) { max = c; top = k }
  return top ? `${top} (${max})` : null
}

// Latest value, with the earlier one when it changed during the log
function latestOf(values: string[]): string | null {
  if (values.length === 0) return null
  const last = values[values.length - 1]
  const prev = [...values].reverse().find(v => v !== last)
  return prev ? `${last} (previously ${prev})` : last
}

// Linux agent lines: "2026-01-05 10:00:00 INFO  message", also WARN, ERROR, DEBUG and FILE CHECK
const reAgentLine = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (INFO|WARN|ERROR|DEBUG|FILE CHECK)\s+(.*)$/
// FILE CHECK Filename=/usr/bin/ps Hash="<sha256> not found in the database" Type=1 Result="Blocking File - Blocked Execution" Blocking Reasons==> GrandParent="..." Parent="..." Path="..." Publisher="..."
// FILE CHECK Filename=/usr/bin/cat Hash=<sha256> Type=5 Result="(CACHED) Allowing file to run - Trusted Publisher Execution"
const reFileCheck = /^Filename=(.+?) Hash=(?:"[^"]*"|\S+) Type=\d+ Result="([^"]*)"(.*)$/
const reGuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

// Windows agent lines are tab-separated: "01/13/2026 9:00:00 AM<TAB>INFO<TAB>1234<TAB>message".
// The kind is INFO, DEBUG, WARNING, ERROR, FILE CHECK or FILE PRE-CHECK; the number is a thread id.
const reWinAgentLine = /^(\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}(?: [AP]M)?)\t([A-Z][A-Z -]*)\t(\d+)\t(.*)$/
// FILE CHECK: Filename: C:\x.exe, Hash: <sha256>, Rtype=17, PPID=4000, Result: (CACHED) Blocking File - Blocked Execution
// A block is followed by an untimestamped line:
// Blocking Reasons: Hash: <sha256> not found in the database, Path: C:\x.exe not found in Path Exclusion, Publisher: Not Signed not found in Publisher Exclusion, Parent Process: C:\y.exe not found in Process Exclusion
const reWinFileCheck = /^Filename: (.+?), Hash: .*?\bResult: (.*)$/
// FILE PRE-CHECK: Filename: C:\x.exe, FileType: 17, Parent: C:\y.exe, GrandParent: C:\z.exe, User: tester, Hash: <sha256>, Publisher: Not Signed
const reWinPreCheckUser = /, GrandParent: .*?, User: ([^,]+)/
// Browser extension decisions are INFO lines:
// [EXT-BLOCK] Extension Title: Example, Hash: <sha256>, Extension Folder: \Users\..., Extension Path: C:\...\x.crx, Browser: Microsoft Edge, Result: Blocking Extension - Blocked Execution
const reWinExtension = /^\[EXT-BLOCK\] Extension Title: (.*?), Hash: .*, Browser: (.*?), Result: (.*)$/

function newAgentStats(platform: 'linux' | 'windows') {
  return {
    platform,
    agentLines: 0,
    starts: 0,
    stops: 0,
    debugLines: 0,
    debugEnabled: false,
    firstTs: '',
    lastTs: '',
    errors: 0,
    warnings: 0,
    pid: null as string | null,
    agentHash: null as string | null,
    fanotify: false,
    driverError: false,
    rpcSecured: null as string | null,
    rpcPort: null as string | null,
    serverVersion: null as string | null,
    currentVersion: null as string | null,
    computer: null as string | null,
    os: null as string | null,
    linuxFamily: null as string | null,
    kernel: null as string | null,
    cpu: null as string | null,
    user: null as string | null,
    ip: null as string | null,
    machineId: null as string | null,
    packages: 0,
    mountpoints: 0,
    fallback: null as string | null,
    relayCount: null as string | null,
    relayMode: null as string | null,
    connOk: 0,
    connFail: 0,
    checkIns: 0,
    clientId: null as string | null,
    policyIds: [] as string[],
    policyVersions: [] as string[],
    hashDbVersions: [] as string[],
    policyUpdates: 0,
    policyGroups: [] as string[],
    safeModeAt: [] as string[],
    auditModes: [] as { value: string; ts: string }[],
    execs: 0,
    allowed: 0,
    blocked: 0,
    auditBlocked: 0,
    results: new Map<string, number>(),
    executed: new Map<string, number>(),
    blockedFiles: new Map<string, number>(),
    blockedParents: new Map<string, number>(),
    blockedPublishers: new Map<string, number>(),
    users: new Map<string, number>(),
    interopChecks: 0,
    notifications: 0,
    allowMetarules: new Set<string>(),
    blockMetarules: new Set<string>(),
    // Only the Windows agent logs these
    filterStarted: false,
    autoUpdate: [] as string[],
    selfService: [] as string[],
    reflection: [] as string[],
    extensionBlocking: [] as string[],
    aggressiveBoot: [] as string[],
    autoElevate: [] as string[],
    interopNames: new Set<string>(),
    blockedExtensions: new Map<string, number>(),
    constrained: 0,
    languageModes: [] as string[],
    memory: null as string | null,
    submitted: 0,
  }
}

// One pass over the Linux agent's lines, collecting everything the newer fields need
function collectAgentStats(lines: string[]) {
  const s = newAgentStats('linux')

  for (const line of lines) {
    const m = reAgentLine.exec(line)
    if (!m) continue
    const ts = m[1], kind = m[2], msg = m[3]
    s.agentLines += 1
    if (!s.firstTs) s.firstTs = ts
    s.lastTs = ts

    if (kind === 'DEBUG') {
      s.debugLines += 1
      let mm: RegExpMatchArray | null
      if (msg.startsWith('Username - ')) {
        if ((mm = msg.match(/^Username - (.+) = (\d+)$/))) bump(s.users, `${mm[1]} (UID ${mm[2]})`)
      } else if (msg.startsWith('CheckAllowMetaRule:')) {
        if ((mm = msg.match(/\[ ([0-9a-f-]{36}) \]/i))) s.allowMetarules.add(mm[1])
      } else if (msg.startsWith('CheckBlocklistMetaRule:')) {
        if ((mm = msg.match(/\[ ([0-9a-f-]{36}) \]/i))) s.blockMetarules.add(mm[1])
      } else if (msg.startsWith('ES Notify message:')) {
        s.notifications += 1
      } else if (msg.startsWith('GetAPI:') || msg.startsWith('PostAPI:')) {
        if (!s.clientId && (mm = msg.match(/\/api\/(?:gethashdb|setpolicyver|setsafemode)\/([0-9a-f-]{36})/i))) s.clientId = mm[1]
      }
      continue
    }

    if (kind === 'FILE CHECK') {
      if (msg.startsWith('Filename="Interop-')) { s.interopChecks += 1; continue }
      const fc = reFileCheck.exec(msg)
      if (!fc) continue
      const file = fc[1], result = fc[2].replace(/^\(CACHED\)\s*/, ''), reasons = fc[3]
      s.execs += 1
      bump(s.executed, file)
      bump(s.results, result)
      if (!/^Block/i.test(result)) { s.allowed += 1; continue }
      if (/\[Audit\]/i.test(result)) s.auditBlocked += 1
      else s.blocked += 1
      bump(s.blockedFiles, file)
      const parent = reasons.match(/ Parent="(.*?) (?:not )?found in [^"]*"/)
      if (parent) bump(s.blockedParents, parent[1])
      const publisher = reasons.match(/ Publisher="(.*?) (?:not )?found in [^"]*"/)
      if (publisher) bump(s.blockedPublishers, publisher[1])
      continue
    }

    if (kind === 'ERROR') s.errors += 1
    else if (kind === 'WARN') s.warnings += 1

    let mm: RegExpMatchArray | null
    if (msg.startsWith('Starting Airlock Enforcement Agent')) s.starts += 1
    else if (msg.startsWith('Closing fanotify')) s.stops += 1
    else if (msg.includes('Setting to Safe Mode')) s.safeModeAt.push(ts)
    // Logged whenever `airlockcmd status` is run: RPC: GetAgentInfo: Server:"..."  ...  GroupParent:"Parent"  GroupName:"Group"  ...
    else if ((mm = msg.match(/^RPC: GetAgentInfo: .*GroupParent:"([^"]*)"\s+GroupName:"([^"]*)"/))) s.policyGroups.push([mm[1], mm[2]].filter(Boolean).join(' / '))
    else if (msg.startsWith('Refreshing package:')) s.packages += 1
    else if (msg.startsWith('Adding marks to mountpoint:')) s.mountpoints += 1
    else if (msg.startsWith('Debug Logging is now enabled')) s.debugEnabled = true
    else if ((mm = msg.match(/^Airlock PID:\s*(\d+)/))) s.pid = mm[1]
    else if ((mm = msg.match(/^AirlockHash:\s*(\S+)/))) s.agentHash = mm[1]
    else if (msg.startsWith('FANotify launched')) s.fanotify = true
    else if (msg.includes('Error loading kernel driver')) s.driverError = true
    else if ((mm = msg.match(/^RPC communication:\s*(.+)$/))) s.rpcSecured = mm[1].trim()
    else if ((mm = msg.match(/^RPC communication at port\s*(\d+)/))) s.rpcPort = mm[1]
    else if ((mm = msg.match(/^AutoUpdate: Version available in Server - ([\w.-]+), Current version: ([\w.-]+)/))) { s.serverVersion = mm[1]; s.currentVersion = mm[2] }
    else if ((mm = msg.match(/^Computer Name:\s*(.+)$/))) s.computer = mm[1].trim()
    else if ((mm = msg.match(/^OS:\s*(.+)$/))) s.os = mm[1].trim()
    else if ((mm = msg.match(/^Linux:\s*(.+)$/))) s.linuxFamily = mm[1].trim()
    else if ((mm = msg.match(/^Kernel:\s*(.+)$/))) s.kernel = mm[1].trim()
    else if ((mm = msg.match(/^CPU Core Count:\s*(\d+)/))) s.cpu = mm[1]
    else if ((mm = msg.match(/^Logged User:\s*(.+)$/))) s.user = mm[1].trim()
    else if ((mm = msg.match(/^Local IP Address:\s*(\S+)/))) s.ip = mm[1]
    else if ((mm = msg.match(/^Machine Id:\s*(\S+)/))) s.machineId = mm[1]
    else if ((mm = msg.match(/^Configuration ~ Primary Airlock Server ~ (\S+) \(fallback\)/))) s.fallback = mm[1]
    else if ((mm = msg.match(/^Relay Count =\s*(\d+)/))) s.relayCount = mm[1]
    else if ((mm = msg.match(/^Relay Mode =\s*(.*)$/))) s.relayMode = mm[1].trim()
    else if (msg.includes('Establish Connection ~ Connect ~')) {
      if (msg.includes('contacted successfully')) s.connOk += 1
      else if (msg.includes('unable to connect')) s.connFail += 1
    }
    else if (msg.startsWith('Check In ~ Report Status')) s.checkIns += 1
    else if ((mm = msg.match(/^Init Policy:\s*(.+)$/))) {
      const ids = mm[1].match(reGuid) ?? []
      if (ids[0] && !s.clientId) s.clientId = ids[0]
      if (ids[1]) s.policyIds.push(ids[1])
    }
    else if ((mm = msg.match(/Client was moved to a new policy with policyid:\s*([0-9a-f-]{36})/i))) s.policyIds.push(mm[1])
    else if ((mm = msg.match(/Policy Update ~ Checking for new policy version the current version is (\d+)/))) s.policyVersions.push(mm[1])
    else if ((mm = msg.match(/Policy Update ~ New policy version applied successfully, version is now (\d+)/))) { s.policyVersions.push(mm[1]); s.policyUpdates += 1 }
    else if ((mm = msg.match(/^Current hash database version verified:\s*(\d+)/))) s.hashDbVersions.push(mm[1])
    else if ((mm = msg.match(/Hash DB Update ~ New hash database version applied successfully, version is now (\d+)/))) s.hashDbVersions.push(mm[1])
    else if ((mm = msg.match(/^Auditmode:\s*(true|false)/i))) s.auditModes.push({ value: mm[1].toLowerCase() === 'true' ? 'Yes' : 'No', ts })
  }
  return s
}

// The same pass for the Windows agent, filling the same shape
function collectWindowsAgentStats(lines: string[]) {
  const s = newAgentStats('windows')
  const mb = (bytes: string) => (Number(bytes) / 1048576).toFixed(1)
  // True right after a blocked FILE CHECK, whose "Blocking Reasons:" line comes next
  let afterBlock = false
  // Which list each worker thread is checking, so a metarule check can be put down to the right one
  const checking = new Map<string, 'block' | 'allow'>()

  for (const line of lines) {
    const m = reWinAgentLine.exec(line)
    if (!m) {
      if (afterBlock && line.startsWith('Blocking Reasons:')) {
        const parent = line.match(/, Parent Process: (.*?) not found in /)
        if (parent) bump(s.blockedParents, parent[1])
        const publisher = line.match(/, Publisher: (.*?) not found in /)
        if (publisher) bump(s.blockedPublishers, publisher[1])
      }
      afterBlock = false
      continue
    }
    afterBlock = false
    const ts = m[1], kind = m[2], thread = m[3], msg = m[4]
    s.agentLines += 1
    if (!s.firstTs) s.firstTs = ts
    s.lastTs = ts
    let mm: RegExpMatchArray | null

    if (kind === 'DEBUG') {
      s.debugLines += 1
      if (msg.endsWith(' start blocklist processing...') || msg.endsWith(' re-checking blocklist metarules')) checking.set(thread, 'block')
      else if (msg.endsWith(' start allowlist processing...') || msg.endsWith(' re-checking allowlist metarules')) checking.set(thread, 'allow')
      // Filename: C:\x.exe, Package: 123, Metarule: name[<guid>] Check: origname match name
      else if ((mm = msg.match(/, Metarule: .*\[([0-9a-f-]{36})\] Check: /i))) {
        const list = checking.get(thread)
        if (list === 'block') s.blockMetarules.add(mm[1])
        else if (list === 'allow') s.allowMetarules.add(mm[1])
      }
      else if ((mm = msg.match(/^\[CONSTRAINED-MODE\] Setting Powershell Language Mode to (.+?)\.*$/))) s.languageModes.push(mm[1].trim())
      if ((mm = msg.match(/^Extension Blocking is (.+)$/))) s.extensionBlocking.push(`${mm[1].charAt(0).toUpperCase()}${mm[1].slice(1).trim()} (logged at ${ts})`)
      continue
    }

    if (kind === 'FILE PRE-CHECK') {
      if ((mm = msg.match(reWinPreCheckUser))) bump(s.users, mm[1].trim())
      continue
    }

    if (kind === 'FILE CHECK') {
      const fc = reWinFileCheck.exec(msg)
      if (!fc) {
        // Older agents log less after the file name; still count the execution
        if ((mm = msg.match(/^Filename:\s*([^,]+)/))) { s.execs += 1; bump(s.executed, mm[1].trim()) }
        continue
      }
      const file = fc[1], result = fc[2].replace(/^\(CACHED\)\s*/, '')
      s.execs += 1
      bump(s.executed, file)
      bump(s.results, result)
      if (!/^Block/i.test(result)) { s.allowed += 1; continue }
      if (/\[Audit\]/i.test(result)) s.auditBlocked += 1
      else if (/Constrained Execution/i.test(result)) s.constrained += 1
      else s.blocked += 1
      bump(s.blockedFiles, file)
      afterBlock = true
      continue
    }

    if (kind === 'ERROR') s.errors += 1
    else if (kind === 'WARNING') s.warnings += 1

    if ((mm = msg.match(/^Starting Airlock Enforcement Agent \([^)]*\)(?: on (.+))?$/))) {
      s.starts += 1
      if (mm[1]) s.os = mm[1].trim()
    }
    else if (msg.startsWith('Airlock Digital - Closed!')) s.stops += 1
    else if (msg.startsWith('Sent Signal for Kernel to start')) s.filterStarted = true
    else if ((mm = msg.match(/^Computer Name:\s*([^,]+)/))) s.computer = mm[1].trim()
    else if ((mm = msg.match(/^Local IP:\s*(\S+)/))) s.ip = mm[1]
    else if ((mm = msg.match(/^Configuration ~ Primary Airlock Server ~ (\S+) \(fallback\)/))) s.fallback = mm[1]
    else if (msg.startsWith('Establish Connection ~ Connect Error Details')) s.connFail += 1
    else if (msg.startsWith('Establish Connection ~ Connect ~')) {
      if (msg.includes('contacted successfully')) s.connOk += 1
      else if (!s.clientId && (mm = msg.match(/\/api\/(?:gethashdb|setpolicyver|setsafemode)\/([0-9a-f-]{36})/i))) s.clientId = mm[1]
    }
    else if (msg.startsWith('Check In ~ Report Status')) s.checkIns += 1
    // The policy database is named after the client id, the hash database after the policy id
    else if ((mm = msg.match(/^Opening Policy database: .*?([0-9a-f-]{36})\.db$/i))) { if (!s.clientId) s.clientId = mm[1] }
    else if ((mm = msg.match(/^Initializing Hash database: .*?([0-9a-f-]{36})\.db$/i))) s.policyIds.push(mm[1])
    else if ((mm = msg.match(/Client was moved to a new policy with policyid:\s*([0-9a-f-]{36})/i))) s.policyIds.push(mm[1])
    else if ((mm = msg.match(/^Policy version retrieval - .* Policy Version: (\d+)$/))) s.policyVersions.push(mm[1])
    else if ((mm = msg.match(/Policy Update ~ Checking for new policy version the current version is (\d+)/))) s.policyVersions.push(mm[1])
    else if ((mm = msg.match(/Policy Update ~ New policy version applied successfully, version is now (\d+)/))) { s.policyVersions.push(mm[1]); s.policyUpdates += 1 }
    else if ((mm = msg.match(/^Current hash database version verified:\s*(\d+)/))) s.hashDbVersions.push(mm[1])
    else if ((mm = msg.match(/Hash DB Update ~ New hash database applied successfully, version is now (\d+)/))) s.hashDbVersions.push(mm[1])
    else if ((mm = msg.match(/^Auditmode:\s*(true|false)/i))) s.auditModes.push({ value: mm[1].toLowerCase() === 'true' ? 'Yes' : 'No', ts })
    else if ((mm = msg.match(/^AutoUpdate:\s*(true|false)/i))) s.autoUpdate.push(mm[1].toLowerCase() === 'true' ? 'True' : 'False')
    else if ((mm = msg.match(/^AutoUpdate ~ Current Version: (\S+) Target Version: (\S+)/))) { s.currentVersion = mm[1]; s.serverVersion = mm[2] }
    else if ((mm = msg.match(/^AutoElevate:\s*(true|false)/i))) s.autoElevate.push(mm[1].toLowerCase() === 'true' ? 'Yes' : 'No')
    else if ((mm = msg.match(/^Assembly Reflection:\s*(\w+)/))) s.reflection.push(String(normalizeBool(mm[1])))
    else if ((mm = msg.match(/^Self Service (?:is )?(enabled|disabled)(?: for (.+))?$/i))) s.selfService.push(mm[1].toLowerCase() === 'disabled' ? 'No' : mm[2] ? `Yes (${mm[2].trim()})` : 'Yes')
    else if ((mm = msg.match(/^Aggressive Boot (?:is|was successfully) (enabled|disabled)/i))) s.aggressiveBoot.push(mm[1].toLowerCase() === 'enabled' ? 'Yes' : 'No')
    else if ((mm = msg.match(/^Current Stats ~ Virtual Memory: (\d+) Physical Memory: (\d+) Handles: (\d+)/))) s.memory = `${mb(mm[2])} MB physical, ${mb(mm[1])} MB virtual, ${mm[3]} handles`
    else if ((mm = msg.match(/^(.+?) Interop Detection: found/))) s.interopNames.add(mm[1].trim())
    else if ((mm = reWinExtension.exec(msg))) { if (/^Block/i.test(mm[3])) bump(s.blockedExtensions, `${mm[1]}, ${mm[2]}`) }
    else if (msg.includes('Uploading Events ~ Submitting untrusted file:')) s.submitted += 1
  }
  return s
}

export function extractAirlockSummary(text: string): Record<(typeof AIRLOCK_FIELDS)[number], string> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const linuxStats = collectAgentStats(lines)
  const stats = linuxStats.agentLines > 0 ? linuxStats : collectWindowsAgentStats(lines)
  const count = (n: number) => (n > 0 ? String(n) : null)
  const get = (key: (typeof AIRLOCK_FIELDS)[number]): string | null => {
    switch (key) {
      case 'Agent Starts':
        return count(stats.starts)
      case 'Agent Stops':
        return count(stats.stops)
      case 'Debug Logging':
        if (stats.agentLines === 0) return null
        return stats.debugLines > 0 || stats.debugEnabled ? `Yes (${stats.debugLines} debug lines)` : 'No'
      case 'Log Period':
        return stats.firstTs ? `${stats.firstTs} to ${stats.lastTs}` : null
      case 'Errors and Warnings':
        if (stats.agentLines === 0) return null
        return `${stats.errors} errors, ${stats.warnings} warnings`
      case 'Agent PID':
        return stats.pid
      case 'Agent Hash':
        return stats.agentHash
      case 'Agent Memory':
        return stats.memory
      case 'Extension Blocking':
        // Only logged when the agent starts, so the time matters: a later policy can change it without a line
        return stats.extensionBlocking[stats.extensionBlocking.length - 1] ?? null
      case 'Aggressive Boot':
        return latestOf(stats.aggressiveBoot)
      case 'Auto Elevate':
        return latestOf(stats.autoElevate)
      case 'Untrusted Files Submitted':
        return count(stats.submitted)
      case 'Blocked Browser Extensions':
        if (stats.blockedExtensions.size === 0) return null
        return [...stats.blockedExtensions].sort((a, b) => b[1] - a[1]).map(([e, c]) => `${e} (${c})`).join('\n')
      case 'Kernel Mode':
        if (stats.filterStarted) return 'Filter driver started'
        if (stats.fanotify) return stats.driverError ? 'FANotify (kernel driver did not load)' : 'FANotify'
        return stats.driverError ? 'Kernel driver did not load' : null
      case 'RPC':
        if (!stats.rpcPort && !stats.rpcSecured) return null
        return [stats.rpcSecured, stats.rpcPort ? `port ${stats.rpcPort}` : null].filter(Boolean).join(', ')
      case 'Server Agent Version':
        if (!stats.serverVersion) return null
        return stats.currentVersion ? `${stats.serverVersion} (agent is ${stats.currentVersion})` : stats.serverVersion
      case 'Computer Name':
        return stats.computer
      case 'Operating System':
        if (!stats.os) return stats.linuxFamily
        return stats.linuxFamily ? `${stats.os} (${stats.linuxFamily})` : stats.os
      case 'Kernel':
        return stats.kernel
      case 'CPU Cores':
        return stats.cpu
      case 'Logged User':
        return stats.user
      case 'Local IP Address':
        return stats.ip
      case 'Machine Id':
        return stats.machineId
      case 'Packages Indexed':
        return count(stats.packages)
      case 'Mountpoints Monitored':
        return count(stats.mountpoints)
      case 'Fallback Server':
        return stats.fallback
      case 'Relay':
        if (stats.relayCount == null) return null
        return stats.relayMode ? `${stats.relayCount} (mode ${stats.relayMode})` : stats.relayCount
      case 'Server Connections':
        if (stats.connOk + stats.connFail === 0) return null
        return `${stats.connOk} ok, ${stats.connFail} failed`
      case 'Check Ins':
        return count(stats.checkIns)
      case 'Client Id':
        return stats.clientId
      case 'Hash DB Version':
        return latestOf(stats.hashDbVersions)
      case 'Policy Id':
        return latestOf(stats.policyIds)
      case 'Policy Updates':
        return count(stats.policyUpdates)
      case 'Policy Group':
        return latestOf(stats.policyGroups)
      case 'Safe Mode':
        if (stats.safeModeAt.length === 0) return null
        return `Entered ${stats.safeModeAt.length} time${stats.safeModeAt.length === 1 ? '' : 's'} (last at ${stats.safeModeAt[stats.safeModeAt.length - 1]})`
      case 'Allowed Executions':
        return stats.execs > 0 ? String(stats.allowed) : null
      case 'Blocked Executions':
        return stats.execs > 0 ? String(stats.blocked) : null
      case 'Audit Blocks':
        return stats.execs > 0 ? String(stats.auditBlocked) : null
      case 'Constrained Executions':
        return stats.platform === 'windows' && stats.execs > 0 ? String(stats.constrained) : null
      case 'Execution Results':
        if (stats.results.size === 0) return null
        return [...stats.results].sort((a, b) => b[1] - a[1]).map(([r, c]) => `${r} (${c})`).join('\n')
      case 'Top Blocked File':
        return topOf(stats.blockedFiles)
      case 'Top Blocked Parent':
        return topOf(stats.blockedParents)
      case 'Top Blocked Publisher':
        return topOf(stats.blockedPublishers)
      case 'Users Seen':
        if (stats.users.size === 0) return null
        return [...stats.users].sort((a, b) => b[1] - a[1]).map(([u]) => u).join(', ')
      case 'Interop Checks':
        return count(stats.interopChecks)
      case 'Block Notifications':
        return count(stats.notifications)
      case 'Airlock Version': {
        const m = findFirst(lines, [
          /Starting\s+Airlock\s+Enforcement\s+Agent\s*\(v([^)]+)\)/i,
          /airlock\s*(?:digital)?\s*(?:version|v)[:=\s]+([0-9]+(?:\.[0-9]+){1,3}(?:[-+][\w.]+)?)/i,
          /\bversion[:=\s]+([0-9]+(?:\.[0-9]+){1,3}(?:[-+][\w.]+)?)/i,
        ])
        return m ? String(m[1]) : null
      }
      case 'Proxy Configured': {
        // Handle explicit negative: "Proxy not configured"
        const neg = lines.find(l => /proxy\s+not\s+configured/i.test(l))
        if (neg) return 'No'
        const m = findFirst(lines, [
          /proxy\s+configured/i,
          /proxy.*?(configured|enabled)[:=\s]+(true|false|yes|no|on|off)/i,
        ])
        if (!m) return null
        if (/proxy\s+configured/i.test(m[0])) return 'Yes'
        return String(normalizeBool((m[2] as any) || (m[1] as any)))
      }
      case 'Primary Airlock Server': {
        // Prefer Configuration ~ Primary Airlock Server ~ <value>
        const m1 = lines.find(l => /Configuration\s*~\s*Primary\s*Airlock\s*Server\s*~\s*/i.test(l))
        if (m1) {
          const mm = m1.match(/Primary\s*Airlock\s*Server\s*~\s*([^\s]+)(?:\s+\(fallback\))?/i)
          if (mm) return mm[1]
        }
        const m = findFirst(lines, [
          /(primary\s*airlock\s*server|primary\s*server|server\s*(?:url|host))[:=\s]+([^\s,;]+)/i,
        ])
        return m ? String(m[2]) : null
      }
      case 'Interops Found': {
        if (stats.interopNames.size > 0) return [...stats.interopNames].join(', ')
        // Count Interop PIDs
        const count = lines.reduce((acc, l) => acc + (/(^|\s)Interop\s+PID:\s*\d+/i.test(l) ? 1 : 0), 0)
        if (count > 0) return String(count)
        // Fallback: detection found
        const found = lines.find(l => /Interop\s+Detection:\s*found/i.test(l))
        if (found) return '1'
        return null
      }
      case 'Interop Paths': {
        // Count lines containing "Loading Interop Trusted Path:"
        const count = lines.reduce((acc, l) => acc + (/Loading\s+Interop\s+Trusted\s+Path:/i.test(l) ? 1 : 0), 0)
        return count > 0 ? String(count) : null
      }
      case 'Policy DB Loaded': {
        // Consider DB opened as loaded
        if (lines.find(l => /Opening\s+Policy\s+database/i.test(l))) return 'Yes'
        // Linux agent: policy init indicates DB presence
        if (lines.find(l => /\bInit\s+Policy:\s*/i.test(l))) return 'Yes'
        const m = findFirst(lines, [
          /policy\s*db.*loaded[:=\s]+(true|false|yes|no|on|off)/i,
          /loaded\s+policy\s+(?:database|db)/i,
        ])
        if (!m) return null
        return m[1] ? String(normalizeBool(m[1] as any)) : 'Yes'
      }
      case 'Policy DB Version': {
        if (stats.policyVersions.length > 0) return latestOf(stats.policyVersions)
        const m = findFirst(lines, [
          // Linux agent: explicit current version line
          /Policy\s*Update.*current\s+version\s+is\s+(\d+)/i,
          /Policy\s+Version:\s*([\w.-]+)/i,
          /policy\s*db\s*(?:version|ver)[:=\s]+([\w.-]+)/i,
          // Linux agent: REST path contains policy version
          /\/api\/setpolicyver\/[^/]+\/(\d+)/i,
        ])
        return m ? String(m[1]) : null
      }
      case 'Audit Mode': {
        if (stats.auditModes.length > 0) {
          const last = stats.auditModes[stats.auditModes.length - 1]
          // Time of the most recent switch, not of the last line that repeats the current value
          let since = stats.auditModes.length - 1
          while (since > 0 && stats.auditModes[since - 1].value === last.value) since -= 1
          if (since === 0) return last.value
          return `${last.value} (changed from ${last.value === 'Yes' ? 'No' : 'Yes'} at ${stats.auditModes[since].ts})`
        }
        const m = findFirst(lines, [
          /audit\s*mode[:=\s]+(enabled|disabled|on|off|true|false)/i,
          /Auditmode:\s*(true|false|yes|no|on|off)/i,
        ])
        return m ? String(normalizeBool(m[1] as any)) : null
      }
      case 'AutoUpdate Enabled': {
        if (stats.autoUpdate.length > 0) return latestOf(stats.autoUpdate)
        const m = findFirst(lines, [
          /^\S*\s*AutoUpdate:\s*(true|false|yes|no|on|off)/i,
          /(autoupdate|auto\s*update).*?\b(enabled|disabled|on|off|true|false)\b/i,
        ])
        if (!m) return null
        // Prefer the boolean value capture group
        let val: string | null = null
        for (let i = 1; i < m.length; i++) {
          const g = m[i]
          if (g && /(true|false|yes|no|on|off|enabled|disabled)/i.test(g)) { val = g; break }
        }
        return normalizeToTrueFalse(val)
      }
      case 'Powershell Constrained Mode': {
        if (stats.languageModes.length > 0) return latestOf(stats.languageModes)
        // Detect default setting explicitly
        if (lines.find(l => /\[CONSTRAINED-MODE\].*Language\s*Mode\s*to\s*default/i.test(l))) return 'default'
        const m = findFirst(lines, [
          /powershell\s*constrained\s*mode[:=\s]+(enabled|disabled|on|off|true|false)/i,
          /Language\s*Mode\s*to\s*ConstrainedLanguage/i,
        ])
        if (!m) return null
        if (/ConstrainedLanguage/i.test(m[0])) return 'Yes'
        return String(normalizeBool(m[1] as any))
      }
      case 'File Extensions Added': {
        // The list is logged again on every policy load, so count each extension once
        const added = new Set<string>()
        for (const l of lines) {
          const mm = l.match(/\bAdding\s+File\s+Extension:\s*(\w+)/i)
          if (mm) added.add(mm[1].toLowerCase())
        }
        if (added.size > 0) return String(added.size)
        const m = findFirst(lines, [
          /file\s*extensions?\s*added[:=\s]+(\d+)/i,
        ])
        return m ? String(m[1]) : null
      }
      case 'Publishers Loaded': {
        const count = lines.reduce((acc, l) => acc + (/\bLoading\s+Publisher:\s*/i.test(l) ? 1 : 0), 0)
        if (count > 0) return String(count)
        // Non-debug Airlock: tab-separated INFO lines with Found Publisher
        const nonDebugCount = lines.reduce((acc, l) => acc + (/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM)\s+INFO\s+\d+\s+Found\s+Publisher:\s*/i.test(l) ? 1 : 0), 0)
        if (nonDebugCount > 0) return String(nonDebugCount)
        const m = findFirst(lines, [
          /publishers?\s*(?:loaded|count)[:=\s]+(\d+)/i,
        ])
        return m ? String(m[1]) : null
      }
      case 'Path Exclusions': {
        // Count exclusions; do not show actual data
        let count = 0
        for (const l of lines) {
          let m
          if ((m = l.match(/Adding\s+Path\s+Exclusion[:=\s]+(.+)/i))) count += 1
          else if ((m = l.match(/Excluding\s+Path[:=\s]+(.+)/i))) count += 1
          else if ((m = l.match(/Path\s*Exclusions?[:=\s]+(.+)/i))) {
            const tokens = m[1].split(/[;,]+/).map(s => s.trim()).filter(Boolean)
            count += tokens.length
          }
          // Non-debug Airlock: tab-separated INFO lines with Found Path
          else if ((m = l.match(/^\s*\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM)\s+INFO\s+\d+\s+Found\s+Path:\s*\((.+?)\)/))) {
            count += 1
          }
        }
        return count > 0 ? String(count) : null
      }
      case 'Assembly Reflection Enabled': {
        if (stats.reflection.length > 0) return latestOf(stats.reflection)
        const m = findFirst(lines, [
          /assembly\s*reflection.*?(enabled|disabled|on|off|true|false)/i,
          /Reflection\s*Enabled[:=\s]+(true|false|yes|no|on|off)/i,
        ])
        return m ? String(normalizeBool(m[1] as any)) : null
      }
      case 'Self Service Enabled': {
        if (stats.selfService.length > 0) return latestOf(stats.selfService)
        const m = findFirst(lines, [
          /self\s*service.*?(enabled|disabled|on|off|true|false)/i,
          /Self\s*Service[:=\s]+(true|false|yes|no|on|off)/i,
        ])
        return m ? String(normalizeBool(m[1] as any)) : null
      }
      case 'Blocklist Metarules loaded': {
        const m = findFirst(lines, [
          /blocklist\s*metarules?\s*(?:loaded|count)[:=\s]+(\d+)/i,
          /Blocklist\s*Metarules\s*loaded:\s*(\d+)/i,
        ])
        if (m) return String(m[1])
        // Count unique Metarule names across Linux and Windows variants
        const linuxNameRe = /Loading\s+metarules\b[^\r\n]*?\bMetarule:\s*(.+?)\s*$/i
        const windowsNameRe = /Loading\s+Blocklist\s+Metarule:\s*(.+?)\s*$/i
        const uniqNames = new Set<string>()
        for (const l of lines) {
          let mm = l.match(linuxNameRe)
          if (mm) { uniqNames.add(mm[1].trim()); continue }
          mm = l.match(windowsNameRe)
          if (mm) { uniqNames.add(mm[1].trim()); continue }
        }
        if (uniqNames.size > 0) return String(uniqNames.size)
        // Linux 7.x does not list rules on load; debug logs name each rule as it is checked
        return stats.blockMetarules.size > 0 ? `${stats.blockMetarules.size} (seen in rule checks)` : null
      }
      case 'Allowlist Metarules loaded': {
        // Numeric total if present
        const m = findFirst(lines, [
          /allowlist\s*metarules?\s*(?:loaded|count)[:=\s]+(\d+)/i,
          /Allowlist\s*Metarules\s*loaded:\s*(\d+)/i,
        ])
        if (m) return String(m[1])
        // Linux + Windows: count unique Metarule names
        const linuxNameRe = /Loading\s+ametarules\b[^\r\n]*?\bMetarule:\s*(.+?)\s*$/i
        const windowsNameRe = /Loading\s+Allowlist\s+Metarule:\s*(.+?)\s*$/i
        const uniqNames = new Set<string>()
        for (const l of lines) {
          let mm = l.match(linuxNameRe)
          if (mm) { uniqNames.add(mm[1].trim()); continue }
          mm = l.match(windowsNameRe)
          if (mm) { uniqNames.add(mm[1].trim()); continue }
        }
        if (uniqNames.size > 0) return String(uniqNames.size)
        return stats.allowMetarules.size > 0 ? `${stats.allowMetarules.size} (seen in rule checks)` : null
      }
      case 'Allowlist Browser Extensions loaded': {
        const m = findFirst(lines, [
          /(allowlist|whitelist)?\s*browser\s*extensions?\s*(?:loaded|count)[:=\s]+(\d+)/i,
          /Allowlist\s*Browser\s*Extensions\s*loaded:\s*(\d+)/i,
        ])
        if (m) {
          // Prefer the numeric capture
          for (let i = m.length - 1; i >= 1; i--) {
            const g = m[i]
            if (g && /^\d+$/.test(g)) return g
          }
        }
        // Fallback: count likely lines mentioning browser extensions
        const count = lines.reduce((acc, l) => acc + (/Browser\s*Extension/i.test(l) ? 1 : 0), 0)
        return count > 0 ? String(count) : null
      }
      case 'Parent Processes': {
        // Count unique parent process entries across Windows and Linux
        // Windows: "...Loading Parent Process: C:\\path\\app.exe"
        const winRe = /Loading\s+Parent\s+Process:\s*(.+?)\s*$/i
        // Linux: "... Loading Process Exclusion (pprocesses): /usr/bin/app"
        const linRe = /Loading\s+Process\s+Exclusion\s*\(pprocesses\)\s*:\s*(.+?)\s*$/i
        const uniq = new Set<string>()
        for (const l of lines) {
          let m = l.match(winRe)
          if (m && m[1]) { uniq.add(m[1].trim().toLowerCase()); continue }
          m = l.match(linRe)
          if (m && m[1]) { uniq.add(m[1].trim().toLowerCase()); continue }
        }
        return uniq.size > 0 ? String(uniq.size) : null
      }
      case 'Execution Count': {
        if (stats.execs > 0) return String(stats.execs)
        // Linux: timestamped FILE CHECK lines indicate execs
        const execLinuxFileCheckStartRe = /^\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+FILE\s+CHECK\s+Filename=([^\s]+)/
        // Windows: SUCCESS lines
        const execWinRe = /Responding\s+to\s+Kernel\s*~\s*Filename:\s*([^~\r\n]+)\s*~\s*SUCCESS/i
        // Non-debug Airlock: tab-separated FILE CHECK lines with timestamp
        const execNonDebugRe = /^\s*\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM)\s+FILE\s+CHECK\s+\d+\s+Filename:\s*([^,\r\n]+)/
        let linStart = 0, win = 0, nonDebug = 0
        for (const l of lines) {
          if (execLinuxFileCheckStartRe.test(l)) linStart += 1
          if (execWinRe.test(l)) win += 1
          if (execNonDebugRe.test(l)) nonDebug += 1
        }
        const total = linStart > 0 ? linStart : (win > 0 ? win : (nonDebug > 0 ? nonDebug : 0))
        return total > 0 ? String(total) : null
      }
      case 'Top Executed File': {
        if (stats.execs > 0) return topOf(stats.executed)
        const execLinuxFileCheckStartRe = /^\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+FILE\s+CHECK\s+Filename=([^\s]+)/
        const execWinRe = /Responding\s+to\s+Kernel\s*~\s*Filename:\s*([^~\r\n]+)\s*~\s*SUCCESS/i
        // Non-debug Airlock: tab-separated FILE CHECK lines with timestamp
        const execNonDebugRe = /^\s*\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM)\s+FILE\s+CHECK\s+\d+\s+Filename:\s*([^,\r\n]+)/
        const countsLinStart: Record<string, number> = {}
        const countsWin: Record<string, number> = {}
        const countsNonDebug: Record<string, number> = {}
        let linStart = 0, win = 0, nonDebug = 0
        for (const l of lines) {
          const mLS = l.match(execLinuxFileCheckStartRe)
          if (mLS) { linStart += 1; const key = mLS[1].trim(); countsLinStart[key] = (countsLinStart[key] ?? 0) + 1 }
          const mW = l.match(execWinRe)
          if (mW) { win += 1; const key = mW[1].trim(); countsWin[key] = (countsWin[key] ?? 0) + 1 }
          const mND = l.match(execNonDebugRe)
          if (mND) { nonDebug += 1; const key = mND[1].trim(); countsNonDebug[key] = (countsNonDebug[key] ?? 0) + 1 }
        }
        const pick = linStart > 0 ? countsLinStart : (win > 0 ? countsWin : (nonDebug > 0 ? countsNonDebug : {}))
        let top: string | null = null
        let max = 0
        for (const k in pick) {
          const c = pick[k]
          if (c > max) { max = c; top = k }
        }
        return top ? `${top} (${max})` : null
      }
      default:
        return null
    }
  }

  const result: Record<(typeof AIRLOCK_FIELDS)[number], string> = {} as any
  for (const k of AIRLOCK_FIELDS) {
    const v = get(k)
    result[k] = v == null || String(v).trim() === '' ? '—' : String(v).trim()
  }
  return result
}

export function printAirlockSummaryToConsole(data: Record<(typeof AIRLOCK_FIELDS)[number], string>) {
  // Print a simple two-column table using console.log
  // Consumers can capture the console if needed.
  // Header
  // eslint-disable-next-line no-console
  console.log('Key | Value')
  // eslint-disable-next-line no-console
  console.log('---|---')
  for (const k of AIRLOCK_FIELDS) {
    // eslint-disable-next-line no-console
    console.log(`${k} | ${data[k]}`)
  }
}

// Build a case-insensitive regex string to find relevant lines for a given field.
export function buildAirlockFieldRegex(
  key: (typeof AIRLOCK_FIELDS)[number],
  data: Record<(typeof AIRLOCK_FIELDS)[number], string>
): string | null {
  switch (key) {
    case 'Airlock Version': {
      const v = data[key]
      if (!v || v === '—') return '(?i)Starting\s+Airlock\s+Enforcement\s+Agent|version'
      return `(?i)Starting\s+Airlock\s+Enforcement\s+Agent|version\s*[:=\s]*${escapeRegex(v)}`
    }
    case 'Proxy Configured':
      return '(?i)Proxy\s+(?:not\s+)?configured'
    case 'Primary Airlock Server': {
      const v = data[key]
      if (!v || v === '—') return '(?i)Primary\s*Airlock\s*Server'
      return `(?i)Primary\s*Airlock\s*Server\s*~\s*${escapeRegex(v)}`
    }
    case 'Interops Found':
      return '(?i)Interop\s+PID|Interop\s+Detection'
    case 'Interop Paths':
      return '(?i)Loading\s+Interop\s+Trusted\s+Path:'
    case 'Policy DB Loaded':
      return '(?i)Opening\s+Policy\s+database|loaded\s+policy\s+(database|db)|Init\\s+Policy:'
    case 'Policy DB Version':
      return '(?i)Policy\\s+Version|/api/setpolicyver/|Policy\\s*Update.*current\\s+version\\s+is'
    case 'Audit Mode':
      return '(?i)Auditmode|Audit\s*Mode'
    case 'AutoUpdate Enabled':
      return '(?i)\bAutoUpdate\b'
    case 'Powershell Constrained Mode':
      return '(?i)\[CONSTRAINED-MODE\]|ConstrainedLanguage|powershell\s*constrained\s*mode'
    case 'File Extensions Added':
      return '(?i)Adding\s+File\s+Extension'
    case 'Publishers Loaded':
      return '(?i)(Loading\s+Publisher|Found\s+Publisher:)'
    case 'Path Exclusions':
      return '(?i)(Loading\s+Path\s+Exclusion|Found\s+Path:)'
    case 'Assembly Reflection Enabled':
      return '(?i)Assembly\s+Reflection'
    case 'Self Service Enabled':
      return '(?i)Self\s*Service'
    case 'Blocklist Metarules loaded':
      return '(?i)Loading\s+Blocklist\s+Metarule|Loading\s+metarules'
    case 'Allowlist Browser Extensions loaded':
      return '(?i)Allowlist\s+Browser\s+Extension'
    case 'Execution Count': {
      // OS-specific: Linux -> timestamped FILE CHECK only; Windows -> SUCCESS lines only
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (fileOnly.startsWith('/')) return '(?i)^\\s*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\s+[^\\r\\n]*?FILE\\s+CHECK\\s+Filename='
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) {
            // Check if it's the non-debug format by looking for the pattern in the data
            // For now, return the Windows SUCCESS pattern as fallback
            return '(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS'
          }
        }
      }
      // Fallback to Linux pattern
      return '(?i)^\\s*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\s+[^\\r\\n]*?FILE\\s+CHECK\\s+Filename='
    }
    case 'Top Executed File': {
      const v = data[key]
      if (!v || v === '—') {
        // Choose OS-specific generic token
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (fileOnly.startsWith('/')) return '(?i)^\\s*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\s+[^\\r\\n]*?FILE\\s+CHECK\\s+Filename='
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return '(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS'
        }
        return '(?i)^\\s*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\s+[^\\r\\n]*?FILE\\s+CHECK\\s+Filename='
      }
      const fileOnly = v.replace(/\s*\(\d+\)\s*$/, '')
      if (fileOnly.startsWith('/')) return `(?i)^\\s*\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\s+[^\\r\\n]*?FILE\\s+CHECK\\s+Filename=${escapeRegex(fileOnly)}`
      // Handle both Windows SUCCESS format and non-debug FILE CHECK format
      if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) {
        // Try to match the non-debug format first, fallback to Windows SUCCESS
        return `(?i)(^\\s*\\d{2}/\\d{2}/\\d{4}\\s+\\d{1,2}:\\d{2}:\\d{2}\\s+(?:AM|PM)\\s+FILE\\s+CHECK\\s+\\d+\\s+Filename:\\s*${escapeRegex(fileOnly)}|Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS)`
      }
      return `(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS`
    }
    default:
      return null
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Rows from the Windows agent read "<time> <LEVEL> [thread] message", or "<time> <LEVEL> FILE CHECK [thread] Filename: ..."
function isWindowsSummary(data?: Record<AirlockField, string>): boolean {
  if (!data) return false
  if (data['Operating System']?.startsWith('Windows')) return true
  return /^[A-Za-z]:\\|^\\\\/.test(data['Top Executed File'] ?? '')
}

// Searches that differ for the Windows agent; null means the shared one below applies
function windowsFieldSearchString(key: AirlockField, data: Record<AirlockField, string>): string | null {
  const value = () => escapeRegex(data[key].replace(/\s*\(\d+\)\s*$/, ''))
  switch (key) {
    case 'Agent Stops':
      return 'Airlock Digital - Closed!'
    case 'Debug Logging':
      return '[AP]M DEBUG \\['
    case 'Errors and Warnings':
      // A blocked browser extension is an ERROR row too, but it is a decision, not an agent error
      return '(ERROR|WARN) \\[\\d+\\] (?!\\[EXT-BLOCK\\] Extension Title)'
    case 'Agent Memory':
      return 'Current Stats ~'
    case 'Kernel Mode':
      return 'Sent Signal for Kernel to start'
    case 'Server Agent Version':
      return 'AutoUpdate ~ Current Version'
    case 'Operating System':
      return 'Starting Airlock Enforcement Agent'
    case 'Local IP Address':
      return 'Local IP:'
    case 'Server Connections':
      return 'contacted successfully|Connect Error Details'
    case 'Policy Id':
      return 'Initializing Hash database|policyid:'
    case 'Extension Blocking':
      return 'Extension Blocking is'
    case 'Aggressive Boot':
      return 'Aggressive Boot'
    case 'Auto Elevate':
      return 'AutoElevate:'
    case 'Interops Found':
      return 'Interop Detection|Interop PID'
    case 'Execution Count':
    case 'Execution Results':
      return 'FILE CHECK \\[\\d+\\] Filename:'
    case 'Allowed Executions':
      return 'PPID=\\d+, Result: (\\(CACHED\\) )?Allow'
    case 'Blocked Executions':
      return 'PPID=\\d+, Result: (\\(CACHED\\) )?Block(?![^\\n]*(\\[Audit\\]|Constrained Execution))'
    case 'Constrained Executions':
      return 'PPID=\\d+, Result: [^\\n]*Constrained Execution'
    case 'Powershell Constrained Mode':
      return 'Setting Powershell Language Mode'
    case 'Blocklist Metarules loaded':
    case 'Allowlist Metarules loaded':
      return data[key].includes('rule checks') ? ', Metarule: .*\\] Check: ' : null
    case 'Audit Blocks':
      return 'PPID=\\d+, Result: [^\\n]*\\[Audit\\]'
    case 'Top Executed File':
      return `FILE CHECK \\[\\d+\\] Filename: ${value()}, Hash`
    case 'Top Blocked File':
      return `FILE CHECK \\[\\d+\\] Filename: ${value()}, Hash.*Result: (\\(CACHED\\) )?Block`
    case 'Top Blocked Parent':
      return `, Parent Process: ${value()} not found`
    case 'Top Blocked Publisher':
      return `, Publisher: ${value()} not found in Publisher Exclusion`
    case 'Users Seen':
      return 'GrandParent: .*, User: '
    case 'Untrusted Files Submitted':
      return 'Submitting untrusted file'
    case 'Blocked Browser Extensions':
      return '\\[EXT-BLOCK\\] Extension Title: .*, Result: Block'
    default:
      return null
  }
}

// Preferred plain-text search tokens for filtering (non-regex)
export function getAirlockFieldSearchString(key: (typeof AIRLOCK_FIELDS)[number], data?: Record<(typeof AIRLOCK_FIELDS)[number], string>): string {
  if (data && isWindowsSummary(data) && data[key] && data[key] !== '—') {
    const token = windowsFieldSearchString(key, data)
    if (token != null) return token
  }
  switch (key) {
    case 'Airlock Version':
      return 'Starting Airlock Enforcement Agent'
    case 'Proxy Configured':
      return 'Proxy (not )?configured'
    case 'Primary Airlock Server':
      return 'Primary Airlock Server'
    case 'Interops Found':
      return 'Interop PID'
    case 'Interop Paths':
      return 'Loading Interop Trusted Path:'
    case 'Policy DB Loaded': {
      // Prefer OS-specific token: Linux => 'Init Policy:', Windows => 'Opening Policy database'
      // Heuristic: infer OS from the top executed file path style if available
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (fileOnly.startsWith('/')) return 'Init Policy:' // Linux path
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return 'Opening Policy database' // Windows path or UNC
        }
      }
      // Fallback: return a regex that matches both
      return '(?i)(Opening\\s+Policy\\s+database|Init\\s+Policy:)'
    }
    case 'Policy DB Version':
      return 'Policy Version:|/api/setpolicyver/|Policy Update ~ .*version is'
    case 'Audit Mode':
      return 'Auditmode:'
    case 'AutoUpdate Enabled':
      return 'AutoUpdate:'
    case 'Powershell Constrained Mode':
      return 'CONSTRAINED-MODE'
    case 'File Extensions Added':
      return 'Adding File Extension:'
    case 'Publishers Loaded':
      return '(?i)(Loading\\s+Publisher:|Found\\s+Publisher:)'
    case 'Path Exclusions':
      return '(?i)(Loading\\s+Path\\s+Exclusion|Found\\s+Path:)'
    case 'Assembly Reflection Enabled':
      return 'Assembly Reflection'
    case 'Self Service Enabled':
      return 'Self Service'
    case 'Blocklist Metarules loaded': {
      // OS-aware: Linux => 'Loading metarules', Windows => 'Loading Blocklist Metarule'
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (data[key].includes('rule checks')) return 'CheckBlocklistMetaRule:'
          if (fileOnly.startsWith('/')) return 'Loading metarules'
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return 'Loading Blocklist Metarule'
        }
      }
      // Fallback to Linux token
      return 'Loading metarules'
    }
    case 'Allowlist Metarules loaded':
      // Linux: "Loading ametarules  Metarule:"; Windows: "Loading Allowlist Metarule:"
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (data[key].includes('rule checks')) return 'CheckAllowMetaRule:'
          if (fileOnly.startsWith('/')) return 'Loading ametarules'
        }
      }
      return 'Loading Allowlist Metarule'
    case 'Allowlist Browser Extensions loaded':
      return 'Allowlist Browser Extension'
    case 'Parent Processes': {
      // OS-aware search token for quick filtering
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (fileOnly.startsWith('/')) return 'pprocesses'
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return 'Loading Parent Process'
        }
      }
      return 'pprocesses'
    }
    case 'Execution Count':
      // OS-specific search string
      if (data) {
        const top = data['Top Executed File']
        if (top && top !== '—') {
          const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
          if (fileOnly.startsWith('/')) return '(?i)FILE\\s+CHECK\\s+Filename=/'
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) {
            // Handle both Windows SUCCESS format and non-debug FILE CHECK format
            return '(?i)(FILE\\s+CHECK\\s+\\d+\\s+Filename:|Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS)'
          }
        }
      }
      return '(?i)FILE\\s+CHECK\\s+Filename='
    case 'Top Executed File': {
      // OS-specific search string with file if available
      const v = data && data[key]
      if (!v || v === '—') {
        if (data) {
          const top = data['Top Executed File']
          if (top && top !== '—') {
            const fileOnly = top.replace(/\s*\(\d+\)\s*$/, '')
            if (fileOnly.startsWith('/')) return '(?i)FILE\\s+CHECK\\s+Filename=/'
            if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) {
              // Handle both Windows SUCCESS format and non-debug FILE CHECK format
              return '(?i)(FILE\\s+CHECK\\s+\\d+\\s+Filename:|Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS)'
            }
          }
        }
        return '(?i)FILE\\s+CHECK\\s+Filename='
      }
      const fileOnly = v.replace(/\s*\(\d+\)\s*$/, '')
      if (fileOnly.startsWith('/')) return `(?i)FILE\\s+CHECK\\s+Filename=${escapeRegex(fileOnly)}\\s`
      // Handle both Windows SUCCESS format and non-debug FILE CHECK format
      if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) {
        return `(?i)(FILE\\s+CHECK\\s+\\d+\\s+Filename:\\s*${escapeRegex(fileOnly)}|Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS)`
      }
      return `(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS`
    }
    case 'Agent Starts':
      return 'Starting Airlock Enforcement Agent'
    case 'Agent Stops':
      return 'Closing fanotify'
    case 'Debug Logging':
      return 'Debug Logging is'
    case 'Errors and Warnings':
      return '(ERROR|WARN) \\['
    case 'Agent PID':
      return 'Airlock PID:'
    case 'Agent Hash':
      return 'AirlockHash:'
    case 'Kernel Mode':
      return 'INFO (Launching )?FANotify|kernel driver'
    case 'RPC':
      return 'RPC communication'
    case 'Server Agent Version':
      return 'AutoUpdate:'
    case 'Computer Name':
      return 'Computer Name:'
    case 'Operating System':
      return 'INFO (OS|Linux): '
    case 'Kernel':
      return 'INFO Kernel:'
    case 'CPU Cores':
      return 'CPU Core Count:'
    case 'Logged User':
      return 'Logged User:'
    case 'Local IP Address':
      return 'Local IP Address:'
    case 'Machine Id':
      return 'Machine Id:'
    case 'Packages Indexed':
      return 'Refreshing package:'
    case 'Mountpoints Monitored':
      return 'Adding marks to mountpoint:'
    case 'Fallback Server':
      return '\\(fallback\\)'
    case 'Relay':
      return 'Relay Count|Relay Mode'
    case 'Server Connections':
      return 'Establish Connection ~ Connect'
    case 'Check Ins':
      return 'Check In ~ Report Status'
    case 'Client Id': {
      const v = data && data[key]
      return v && v !== '—' ? v : ''
    }
    case 'Hash DB Version':
      return 'hash database version|Hash DB Update'
    case 'Policy Id':
      return 'Init Policy:|policyid:'
    case 'Policy Updates':
      return 'Check In ~ Policy Update'
    case 'Policy Group':
      return 'GetAgentInfo'
    case 'Safe Mode':
      return 'Safe Mode'
    case 'Allowed Executions':
      return 'Result="(\\(CACHED\\) )?Allow'
    case 'Blocked Executions':
      return 'Result="(\\(CACHED\\) )?Block[^"\\[]*"'
    case 'Audit Blocks':
      return '\\[Audit\\]"'
    case 'Execution Results':
      return 'FILE CHECK Filename=/'
    case 'Top Blocked File': {
      const v = data && data[key]
      if (!v || v === '—') return ''
      return `FILE CHECK Filename=${escapeRegex(v.replace(/\s*\(\d+\)\s*$/, ''))}\\s.*Result="(\\(CACHED\\) )?Block`
    }
    case 'Top Blocked Parent': {
      const v = data && data[key]
      if (!v || v === '—') return ''
      return `\\sParent="${escapeRegex(v.replace(/\s*\(\d+\)\s*$/, ''))} (not )?found`
    }
    case 'Top Blocked Publisher': {
      const v = data && data[key]
      if (!v || v === '—') return ''
      return `Publisher="${escapeRegex(v.replace(/\s*\(\d+\)\s*$/, ''))} (not )?found`
    }
    case 'Users Seen':
      return 'Username - '
    case 'Interop Checks':
      return 'Filename="Interop-'
    case 'Block Notifications':
      return 'ES Notify message'
    default:
      return ''
  }
}
