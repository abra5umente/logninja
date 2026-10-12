import { LogEntry, LogLevel } from './types'

// Timestamp patterns
// ISO 8601
const reISO = /^(\s*)(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2}))/
// YYYY-MM-DD HH:mm:ss(.SSS or ,SSS)
const reYMD_HMS = /^(\s*)(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/
// YYYY/MM/DD HH:mm:ss(.SSS or ,SSS)
const reYMD_SLASH_HMS = /^(\s*)(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/
// Support dd/MM/yyyy HH:mm:ss with optional fractional (dot or comma) and optional AM/PM suffix
const reDMY_HMS = /^(\s*)(\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?(?:\s?(?:AM|PM))?)/i
// Support MM/DD/yyyy HH:mm:ss with optional fractional (dot or comma) and optional AM/PM suffix
const reMDY_HMS = /^(\s*)(\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?(?:\s?(?:AM|PM))?)/i
// Support "13 Aug 2025 00:00:02.926" (DD Mon YYYY HH:mm:ss.mmm)
const reDMON_HMS = /^(\s*)(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/
// Support Redis style prefix "284:M " before the above date
const reREDIS_PREFIX_DMON_HMS = /^(\s*\d+:[A-Za-z]\s+)(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/

const levelMap: Record<string, LogLevel> = {
  'ERROR': 'ERROR',
  'ERR': 'ERROR',
  'WARN': 'WARN',
  'WARNING': 'WARN',
  'INFO': 'INFO',
  'DEBUG': 'DEBUG',
  'TRACE': 'TRACE',
}

const reLevel = /(\[)?\b(ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b(\])?/i

type SlashOrder = 'DMY' | 'MDY' | null

function parseDate(ts: string, slashOrder: SlashOrder = null): Date | null {
  // ISO / RFC-3339
  if (/^\d{4}-\d{2}-\d{2}T/.test(ts)) {
    // Offsets may come without a colon (+1000), which Date does not accept everywhere
    const d = new Date(ts.replace(',', '.').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
    return isNaN(d.getTime()) ? null : d
  }
  // YYYY-MM-DD HH:mm:ss(.SSS)?
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(ts)) {
    const isoLike = ts.replace(' ', 'T').replace(',', '.')
    const d = new Date(isoLike)
    return isNaN(d.getTime()) ? null : d
  }
  // YYYY/MM/DD HH:mm:ss(.SSS)?
  if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/.test(ts)) {
    const m = ts.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/)
    if (m) {
      const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3])
      const HH = Number(m[4]), MM = Number(m[5]), SS = Number(m[6])
      const ms = m[7] ? Number(('000' + m[7]).slice(-3)) : 0
      const d = new Date(yyyy, mm - 1, dd, HH, MM, SS, ms)
      return isNaN(d.getTime()) ? null : d
    }
  }
  // YYYY-MM-DD HH:mm:ss:SSS (MSI-style colon before millis)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{1,3}$/.test(ts)) {
    const m = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}):(\d{1,3})$/)
    if (m) {
      const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3])
      const HH = Number(m[4]), MM = Number(m[5]), SS = Number(m[6])
      const ms = Number(('000' + m[7]).slice(-3))
      const d = new Date(yyyy, mm - 1, dd, HH, MM, SS, ms)
      return isNaN(d.getTime()) ? null : d
    }
  }
  // dd/MM/yyyy HH:mm:ss(.SSS)? with optional AM/PM
  if (/^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}/i.test(ts)) {
    const m = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d+))?(?:\s?(AM|PM))?/i)
    if (m) {
      // Use the order settled for the whole file when there is one; otherwise infer it from the values, preferring DMY
      let a = Number(m[1]), b = Number(m[2]), yyyy = Number(m[3])
      let dd: number, mm: number
      if (slashOrder === 'MDY') { dd = b; mm = a } else if (slashOrder === 'DMY') { dd = a; mm = b }
      else if (a > 12 && b <= 12) { dd = a; mm = b } else if (b > 12 && a <= 12) { dd = b; mm = a } else { dd = a; mm = b }
      let HH = Number(m[4]), MM = Number(m[5]), SS = Number(m[6])
      const ms = m[7] ? Number(('000' + m[7]).slice(-3)) : 0
      const ampm = m[8]?.toUpperCase()
      if (ampm === 'PM' && HH < 12) HH += 12
      if (ampm === 'AM' && HH === 12) HH = 0
      const d = new Date(yyyy, mm - 1, dd, HH, MM, SS, ms)
      return isNaN(d.getTime()) ? null : d
    }
  }
  // dd Mon yyyy HH:mm:ss(.SSS)?
  if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/.test(ts)) {
    const m = ts.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/)
    if (m) {
      const dd = Number(m[1])
      const monStr = m[2].toLowerCase()
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      const mm = months.indexOf(monStr)
      const yyyy = Number(m[3])
      let HH = Number(m[4]), MM = Number(m[5]), SS = Number(m[6])
      const ms = m[7] ? Number(('000' + m[7]).slice(-3)) : 0
      const d = new Date(yyyy, mm, dd, HH, MM, SS, ms)
      return isNaN(d.getTime()) ? null : d
    }
  }
  // Apache/Nginx style: dd/Mon/yyyy:HH:mm:ss Z (e.g., 13/Aug/2025:00:00:23 +1000)
  if (/^\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}$/.test(ts)) {
    const m = ts.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})$/)
    if (m) {
      const dd = m[1]
      const monStr = m[2].toLowerCase()
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      const mm = (months.indexOf(monStr) + 1).toString().padStart(2, '0')
      const yyyy = m[3]
      const HH = m[4], MM = m[5], SS = m[6]
      const off = m[7]
      const offISO = off.slice(0, 3) + ':' + off.slice(3)
      const iso = `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}${offISO}`
      const d = new Date(iso)
      return isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

function detectTimestamp(s: string, slashOrder: SlashOrder = null): { tsStr: string; date: Date | null; rest: string } | null {
  for (const re of [reISO, reYMD_HMS, reYMD_SLASH_HMS, reDMY_HMS, reMDY_HMS, reDMON_HMS, reREDIS_PREFIX_DMON_HMS] as const) {
    const m = s.match(re)
    if (m) {
      const tsStr = m[2]
      const rest = s.slice(m[0].length).trimStart()
      return { tsStr, date: parseDate(tsStr, slashOrder), rest }
    }
  }
  return null
}

function detectLevel(s: string): { level: LogLevel; idx: number; len: number } | null {
  // Redis severity symbols at start: '.' debug, '-' verbose/trace, '*' notice/info, '#' warning
  const sym = s.match(/^\s*([.*#-])\s/)
  if (sym) {
    const ch = sym[1]
    const map: Record<string, LogLevel> = { '.': 'DEBUG', '-': 'TRACE', '*': 'INFO', '#': 'WARN' }
    const level = map[ch] ?? 'INFO'
    return { level, idx: sym.index ?? 0, len: sym[0].length }
  }
  const m = s.match(reLevel)
  if (!m) return null
  const level = levelMap[m[2].toUpperCase()] ?? 'UNKNOWN'
  const idx = m.index ?? 0
  const len = m[0].length
  return { level, idx, len }
}

// Level for formats that have no level column. Does not consume anything, so the message stays whole.
// Lowercase "info"/"debug" are left out: they turn up in paths and settings far more often than as a level.
const reLooseLevel = /\b(ERROR|Error|error|WARN|WARNING|Warning|warning|DEBUG|TRACE)\b/
function looseLevel(s: string): LogLevel {
  const m = s.match(reLooseLevel)
  return m ? (levelMap[m[1].toUpperCase()] ?? 'INFO') : 'INFO'
}

// Airlock agent execution decisions: blocked in enforcement is an error, blocked in audit mode is a warning.
// "Blocking File - Constrained Execution" is a PowerShell script that ran, but in Constrained Language Mode: a warning too.
// Linux and macOS write Result="..."; Windows, and macOS for Apple's own binaries, write ", Result: ..." to the end of the line
function airlockFileCheckLevel(rest: string): LogLevel {
  const result = rest.match(/\bResult="([^"]*)"/)?.[1] ?? rest.match(/, Result: ([^\n]*)/)?.[1] ?? rest
  if (!/\bBlock/i.test(result)) return 'INFO'
  return /\[Audit\]|Constrained Execution/i.test(result) ? 'WARN' : 'ERROR'
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

export function parseLog(text: string, fileId: string = '', fileName: string = ''): LogEntry[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: LogEntry[] = []
  let lastEntry: LogEntry | null = null
  let index = 0
  let lineNo = 0
  
  // Performance optimization: limit processing for extremely large files
  const maxLines = 1000000 // 1 million lines max
  const linesToProcess = lines.length > maxLines ? lines.slice(0, maxLines) : lines
  // Pre-scan to capture a base date (Y-M-D) for logs that only provide time-of-day (e.g., MSI)
  let baseYMD: { y: number; m: number; d: number } | null = null
  for (const raw of lines) {
    const line = raw.trim()
    // yyyy-mm-dd ...
    let m: RegExpMatchArray | null = line.match(/(\d{4})-(\d{2})-(\d{2})\s+\d{1,2}:\d{2}:\d{2}/)
    if (m) { baseYMD = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }; break }
    // d/m/yyyy or m/d/yyyy ... (we don't disambiguate day/month; use as-is)
    m = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{1,2}:\d{2}:\d{2}/)
    if (m) { baseYMD = { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) }; break }
  }
  // "10/12/2026" does not say which number is the day. One value above 12 anywhere in the file settles it for every line.
  let slashOrder: SlashOrder = null
  const reSlashDate = /^(?:ServerActivityMessage\|)?\s*(\d{1,2})\/(\d{1,2})\/\d{4} \d/
  for (const raw of linesToProcess) {
    const m = reSlashDate.exec(raw)
    if (!m) continue
    if (Number(m[1]) > 12) { slashOrder = 'DMY'; break }
    if (Number(m[2]) > 12) { slashOrder = 'MDY'; break }
  }
  // Try parsing MongoDB structured JSON lines
  const tryParseMongoJSON = (s: string) => {
    const trimmed = s.trimStart()
    if (!trimmed.startsWith('{')) return null
    try {
      const obj = JSON.parse(trimmed)
      const tsStr = obj?.t?.$date || obj?.t || null
      const msg = obj?.msg
      if (!tsStr || !msg) return null
      const letter = typeof obj.s === 'string' ? obj.s : null
      const letterMap: Record<string, LogLevel> = { F: 'ERROR', E: 'ERROR', W: 'WARN', I: 'INFO', D: 'DEBUG', T: 'TRACE' }
      const level: LogLevel = (letter && (letterMap[letter] as LogLevel)) || 'INFO'
      const source = [obj.c, obj.ctx].filter(Boolean).join(' ')
      const attrStr = obj.attr ? ' ' + JSON.stringify(obj.attr) : ''
      return { tsStr: String(tsStr), level, source: String(source || ''), message: String(msg) + attrStr }
    } catch {
      return null
    }
  }
  // Specific format: resque logs like
  // "resque-scheduler: [INFO] 2025-08-13T00:00:22+10:00: Starting"
  const reResque = /^(\S+):\s+\[(ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\]\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})):\s*(.*)$/
  // Apache Combined Log Format (with user agent), e.g.:
  // 127.0.0.1 - - [13/Aug/2025:00:00:23 +1000] "HEAD / HTTP/1.1" 200 0 "-" "Agent"
  const reApache = /^(\S+)\s+\S+\s+\S+\s+\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\]\s+"([^"]*)"\s+(\d{3})\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"/
  // Ruby logger / Rails style lines, possibly with a prefix like "App 611 output: "
  // Example: "App 611 output: W, [2025-08-13T00:00:02.705332 #611]  WARN -- : message"
  const reRubyLogger = /^(?:([^\[]+?):\s+)?([DIWEF]),\s+\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(?:#[0-9]+)?\]\s+(?:([A-Z]+)\s+--\s+:\s*)?(.*)$/
  // Windows Installer (MSI) logs, e.g.:
  // MSI (c) (1C:50) [12:16:41:491]: message
  // or MSI (s) (...) [2025-08-13 12:16:41:491]: message
  const reMSI = /^MSI\s+\(([a-z])\)\s+\(([0-9A-Fa-f:]+)\)\s+\[([^\]]+)\]:\s*(.*)$/i
  // Airlock Enforcement Agent execution decisions, e.g.:
  // 2026-01-05 10:00:03 FILE CHECK Filename=/usr/bin/x Hash="..." Type=2 Result="Blocking File - Untrusted Execution [Audit]" ...
  const reAirlockFileCheck = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+(FILE CHECK\s.*)$/
  // Airlock Enforcement Agent on macOS: executions of Apple's own binaries were seen logged as INFO lines with no hash, e.g.:
  // 2026-01-05 10:00:03 INFO  FILE CHECK Filename: /bin/ls, OpType: 11, Result: Allowing file to run - Trusted Execution
  // Everything else it checks is written the way the Linux agent writes it, above.
  const reAirlockMacFileCheck = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+INFO\s+(FILE CHECK Filename: .*)$/
  // The macOS agent also reports some failures on INFO lines, e.g.:
  // 2026-01-05 10:00:00 INFO  ERROR: es_new_client() failed with 4
  const reAirlockInfoError = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+INFO\s+(ERROR: .*)$/
  // Airlock Enforcement Agent on Windows: tab-separated time, kind, thread id and message, e.g.:
  // 01/13/2026 9:00:00 AM<TAB>INFO<TAB>1234<TAB>Proxy not configured
  // Kind is INFO, DEBUG, WARNING, ERROR, FILE CHECK or FILE PRE-CHECK. A blocked FILE CHECK is followed by an
  // untimestamped "Blocking Reasons: ..." line, which joins it as a continuation. The thread id stays in the
  // message, in brackets, so one worker's lines can be followed.
  const reAirlockWin = /^(\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2}(?: [AP]M)?)\t([A-Z][A-Z -]*)\t(\d+)(?:\t(.*))?$/
  // Go standard logger with file:line, used by the Airlock server services (clientapi, cloudsvc, cdsync, extlogger, rest, trustbuilder), e.g.:
  // 2026/01/05 10:00:00 service.go:120: POST /api/submitfile from ip: 10.0.0.5 hostname: host
  const reGoLog = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}(?:[.,]\d+)?) ([\w.-]+\.go:\d+): ?(.*)$/
  // Bracketed timestamp with an optional [Tag], used by Airlock server workers (bulkexport, binchkn_inventory, index_health_check), e.g.:
  // [2026-01-05 10:00:10] [Worker] Network error ...   or   [2026-01-05T10:00:11+10:00] Running health check
  const reBracketTs = /^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/
  // Airlock server activity log (svractivities), e.g.:
  // ServerActivityMessage|05/01/2026 02:40:22 PM|Login|admin|User: admin logged in successfully
  const reAirlockActivity = /^ServerActivityMessage\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)$/
  // Phusion Passenger (nginx_error), e.g.:
  // [ N 2026-01-05 10:00:10.0785 4321/T1 age/Cor/Example.cpp:10 ]: Checking connections ...
  const rePassenger = /^\[ ([A-Z]) (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) (\S+) (\S+) \]: ?(.*)$/
  // date(1) output followed by " - message" (startup, db_seed), e.g.:
  // Mon Jan  5 08:00:00 AEDT 2026 - starting up
  const reUnixDate = /^([A-Z][a-z]{2} ([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) [A-Z]{2,5} (\d{4})) - (.*)$/
  // Resque worker job lines have no timestamp at all, e.g.:
  // *** got: (Job{example} | Example | [...])
  const reResqueJob = /^\*\*\* \S/

  const push = (time: Date | null, timeStr: string, level: LogLevel, source: string, message: string, raw: string) => {
    const entry: LogEntry = { index: index++, line: lineNo, time, timeStr, level, source, message, raw, fileId, fileName }
    out.push(entry)
    lastEntry = entry
  }

  for (let lineIdx = 0; lineIdx < linesToProcess.length; lineIdx++) {
    const rawLine = linesToProcess[lineIdx]
    // 1-based line in the file where this entry starts, so the line column matches an editor
    lineNo = lineIdx + 1
    const line = rawLine.trimEnd()
    if (!line) continue

    // These start with a plain timestamp, so they have to be claimed before the generic timestamp rules
    const fc = line.match(reAirlockFileCheck)
    if (fc) {
      push(parseDate(fc[1]), fc[1], airlockFileCheckLevel(fc[2]), 'FILE CHECK', fc[2], rawLine)
      continue
    }
    const mfc = line.match(reAirlockMacFileCheck)
    if (mfc) {
      push(parseDate(mfc[1]), mfc[1], airlockFileCheckLevel(mfc[2]), 'FILE CHECK', mfc[2], rawLine)
      continue
    }
    const ie = line.match(reAirlockInfoError)
    if (ie) {
      push(parseDate(ie[1]), ie[1], 'ERROR', '', ie[2], rawLine)
      continue
    }
    const aw = line.match(reAirlockWin)
    if (aw) {
      const [, tsStr, kind, thread, msg = ''] = aw
      const isCheck = kind.startsWith('FILE ')
      // Execution and browser extension decisions take their level from the result, like the Linux agent's
      const isDecision = kind === 'FILE CHECK' || msg.startsWith('[EXT-BLOCK] Extension Title:')
      const level: LogLevel = isDecision ? airlockFileCheckLevel(msg) : kind === 'FILE PRE-CHECK' ? 'DEBUG' : (levelMap[kind] ?? 'INFO')
      // Read month first, as the agent was seen to write it, unless the file shows otherwise
      push(parseDate(tsStr, slashOrder ?? 'MDY'), tsStr, level, isCheck ? kind : '', `${isCheck ? kind + ' ' : ''}[${thread}] ${msg}`, rawLine)
      continue
    }
    const gl = line.match(reGoLog)
    if (gl) {
      push(parseDate(gl[1]), gl[1], looseLevel(gl[3]), gl[2], `${gl[2]}: ${gl[3]}`, rawLine)
      continue
    }

    const ts = detectTimestamp(line, slashOrder)
    if (!ts) {
      const bt = line.match(reBracketTs)
      if (bt) {
        const tag = bt[2] ?? ''
        push(parseDate(bt[1]), bt[1], looseLevel(bt[3]), tag, tag ? `[${tag}] ${bt[3]}` : bt[3], rawLine)
        continue
      }
      const act = line.match(reAirlockActivity)
      if (act) {
        const [, tsStr, category, user, msg] = act
        push(parseDate(tsStr, slashOrder), tsStr, 'INFO', category, [category, user, msg].filter(Boolean).join(' | '), rawLine)
        continue
      }
      const pm = line.match(rePassenger)
      if (pm) {
        const letterMap: Record<string, LogLevel> = { C: 'ERROR', E: 'ERROR', W: 'WARN', N: 'INFO', I: 'INFO', D: 'DEBUG' }
        push(parseDate(pm[2]), pm[2], letterMap[pm[1]] ?? 'INFO', pm[4], `${pm[4]}: ${pm[5]}`, rawLine)
        continue
      }
      const ud = line.match(reUnixDate)
      if (ud) {
        const mon = MONTHS.indexOf(ud[2].toLowerCase())
        const d = mon < 0 ? null : new Date(Number(ud[7]), mon, Number(ud[3]), Number(ud[4]), Number(ud[5]), Number(ud[6]))
        push(d && !isNaN(d.getTime()) ? d : null, ud[1], looseLevel(ud[8]), '', ud[8], rawLine)
        continue
      }
      if (reResqueJob.test(line)) {
        push(null, '', 'INFO', 'resque', line, rawLine)
        continue
      }
      // Try resque pattern: prefix + [LEVEL] + ISO timestamp + ':' + message
      const rm = line.match(reResque)
      if (rm) {
        const [, source, lvlRaw, tsStr, msg] = rm
        const entry: LogEntry = {
          index: index++,
          line: lineNo,
          time: parseDate(tsStr),
          timeStr: tsStr,
          level: (levelMap[lvlRaw.toUpperCase()] ?? 'INFO') as LogLevel,
          source,
          message: msg,
          raw: rawLine,
          fileId,
          fileName,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Try MSI log format
      const mm = line.match(reMSI)
      if (mm) {
        const [, mode, thread, tsInside, msg] = mm
        let date: Date | null = null
        let tsStr = tsInside
        // If ts includes date and millis separated by colon, try to parse
        if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}:\d{1,3}/.test(tsInside)) {
          date = parseDate(tsInside.replace(/\s+/, ' '))
        } else if (/^\d{2}:\d{2}:\d{2}:\d{1,3}$/.test(tsInside)) {
          // time-only; normalize and, if we have a base date, synthesize a Date for binning
          const m = tsInside.match(/^(\d{2}):(\d{2}):(\d{2}):(\d{1,3})$/)
          if (m) {
            const HH = Number(m[1]), MM = Number(m[2]), SS = Number(m[3]), ms = Number(('000' + m[4]).slice(-3))
            tsStr = `${String(HH).padStart(2,'0')}:${String(MM).padStart(2,'0')}:${String(SS).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
            if (baseYMD) {
              date = new Date(baseYMD.y, baseYMD.m - 1, baseYMD.d, HH, MM, SS, ms)
            }
          }
        }
        const entry: LogEntry = {
          index: index++,
          line: lineNo,
          time: date,
          timeStr: tsStr,
          level: 'INFO',
          source: `MSI (${mode}) ${thread}`,
          message: msg,
          raw: rawLine,
          fileId,
          fileName,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Try Apache/Nginx combined log
      const am = line.match(reApache)
      if (am) {
        const [, ip, tsStr, req, status, size, ref, ua] = am
        const entry: LogEntry = {
          index: index++,
          line: lineNo,
          time: parseDate(tsStr),
          timeStr: tsStr,
          level: Number(status) >= 500 ? 'ERROR' : Number(status) >= 400 ? 'WARN' : 'INFO',
          source: ip,
          message: `${req} ${status} ${size} ${ref !== '-' ? ref : ''} ${ua}`.trim(),
          raw: rawLine,
          fileId,
          fileName,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Try Ruby logger / Rails style
      const rlm = line.match(reRubyLogger)
      if (rlm) {
        const [, prefix, letter, tsStr, levelWord, msg] = rlm
        const letterMap: Record<string, LogLevel> = { D: 'DEBUG', I: 'INFO', W: 'WARN', E: 'ERROR', F: 'ERROR' }
        const levelFromWord = levelWord ? (levelMap[levelWord.toUpperCase()] ?? null) : null
        const level: LogLevel = levelFromWord || letterMap[letter as keyof typeof letterMap] || 'INFO'
        const entry: LogEntry = {
          index: index++,
          line: lineNo,
          time: parseDate(tsStr),
          timeStr: tsStr,
          level,
          source: (prefix || '').trim(),
          message: msg,
          raw: rawLine,
          fileId,
          fileName,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Try MongoDB JSON structured logs
      const mj = tryParseMongoJSON(line)
      if (mj) {
        const entry: LogEntry = {
          index: index++,
          line: lineNo,
          time: parseDate(mj.tsStr),
          timeStr: mj.tsStr,
          level: mj.level,
          source: mj.source,
          message: mj.message,
          raw: rawLine,
          fileId,
          fileName,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Continuation of previous message. Lines with nothing timestamped to attach to
      // (file headers, logs with no timestamps at all) become their own rows instead of being dropped.
      if (lastEntry && lastEntry.timeStr) {
        lastEntry.message += '\n' + line
        lastEntry.raw += '\n' + rawLine
      } else {
        push(null, '', looseLevel(line), '', line, rawLine)
      }
      continue
    }

    // Default to INFO when no explicit level token is present so entries remain visible
    const levelInfo = detectLevel(ts.rest) || { level: 'INFO' as LogLevel, idx: 0, len: 0 }
    const afterLevel = ts.rest
    // Source extraction removed; message is whatever follows the level token
    const message = afterLevel.slice(levelInfo.idx + levelInfo.len).replace(/^[\s:,-]+/, '')

    const entry: LogEntry = {
      index: index++,
      line: lineNo,
      time: ts.date,
      timeStr: ts.tsStr,
      level: levelInfo.level,
      source: '',
      message,
      raw: rawLine,
      fileId,
      fileName,
    }
    out.push(entry)
    lastEntry = entry
  }
  
  // Add warning entry if file was truncated
  if (lines.length > maxLines) {
    out.push({
      index: index++,
      line: maxLines + 1,
      time: null,
      timeStr: '',
      level: 'WARN',
      source: 'LogNinja',
      message: `File truncated: showing first ${maxLines.toLocaleString()} lines of ${lines.length.toLocaleString()} total lines`,
      raw: `[WARN] File truncated: showing first ${maxLines.toLocaleString()} lines of ${lines.length.toLocaleString()} total lines`,
      fileId,
      fileName,
    })
  }
  
  return out
}
