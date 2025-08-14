import { LogEntry, LogLevel } from './types'

// Timestamp patterns
// ISO 8601
const reISO = /^(\s*)(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:\d{2}))/
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

function parseDate(ts: string): Date | null {
  // ISO / RFC-3339
  if (/^\d{4}-\d{2}-\d{2}T/.test(ts)) {
    const d = new Date(ts.replace(',', '.'))
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
      // Try to infer whether it's DMY or MDY by values; prefer DMY when day > 12
      let a = Number(m[1]), b = Number(m[2]), yyyy = Number(m[3])
      let dd: number, mm: number
      if (a > 12 && b <= 12) { dd = a; mm = b } else if (b > 12 && a <= 12) { dd = b; mm = a } else { dd = a; mm = b }
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

function detectTimestamp(s: string): { tsStr: string; date: Date | null; rest: string } | null {
  for (const re of [reISO, reYMD_HMS, reYMD_SLASH_HMS, reDMY_HMS, reMDY_HMS, reDMON_HMS, reREDIS_PREFIX_DMON_HMS] as const) {
    const m = s.match(re)
    if (m) {
      const tsStr = m[2]
      const rest = s.slice(m[0].length).trimStart()
      return { tsStr, date: parseDate(tsStr), rest }
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

export function parseLog(text: string): LogEntry[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: LogEntry[] = []
  let lastEntry: LogEntry | null = null
  let index = 0
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

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) continue

    const ts = detectTimestamp(line)
    if (!ts) {
      // Try resque pattern: prefix + [LEVEL] + ISO timestamp + ':' + message
      const rm = line.match(reResque)
      if (rm) {
        const [, source, lvlRaw, tsStr, msg] = rm
        const entry: LogEntry = {
          index: index++,
          time: parseDate(tsStr),
          timeStr: tsStr,
          level: (levelMap[lvlRaw.toUpperCase()] ?? 'INFO') as LogLevel,
          source,
          message: msg,
          raw: rawLine,
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
          time: date,
          timeStr: tsStr,
          level: 'INFO',
          source: `MSI (${mode}) ${thread}`,
          message: msg,
          raw: rawLine,
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
          time: parseDate(tsStr),
          timeStr: tsStr,
          level: Number(status) >= 500 ? 'ERROR' : Number(status) >= 400 ? 'WARN' : 'INFO',
          source: ip,
          message: `${req} ${status} ${size} ${ref !== '-' ? ref : ''} ${ua}`.trim(),
          raw: rawLine,
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
          time: parseDate(tsStr),
          timeStr: tsStr,
          level,
          source: (prefix || '').trim(),
          message: msg,
          raw: rawLine,
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
          time: parseDate(mj.tsStr),
          timeStr: mj.tsStr,
          level: mj.level,
          source: mj.source,
          message: mj.message,
          raw: rawLine,
        }
        out.push(entry)
        lastEntry = entry
        continue
      }
      // Continuation of previous message
      if (lastEntry) {
        lastEntry.message += '\n' + line
        lastEntry.raw += '\n' + rawLine
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
      time: ts.date,
      timeStr: ts.tsStr,
      level: levelInfo.level,
      source: '',
      message,
      raw: rawLine,
    }
    out.push(entry)
    lastEntry = entry
  }
  return out
}
