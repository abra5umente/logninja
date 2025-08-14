// Airlock Debug Summary (browser): detect by filename and extract summary fields.
// Uses only the standard library.

export const AIRLOCK_FIELDS = [
  'Airlock Version',
  'Proxy Configured',
  'Primary Airlock Server',
  'Interops Found',
  'Policy DB Loaded',
  'Policy DB Version',
  'Audit Mode',
  'AutoUpdate Enabled',
  'Powershell Constrained Mode',
  'File Extensions Added',
  'Publishers Loaded',
  'Path Exclusions',
  'Assembly Reflection Enabled',
  'Self Service Enabled',
  'Blocklist Metarules loaded',
  'Allowlist Metarules loaded',
  'Allowlist Browser Extensions loaded',
  'Parent Processes',
  'Execution Count',
  'Top Executed File',
] as const

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

export function extractAirlockSummary(text: string): Record<(typeof AIRLOCK_FIELDS)[number], string> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const get = (key: (typeof AIRLOCK_FIELDS)[number]): string | null => {
    switch (key) {
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
        // Count Interop PIDs
        const count = lines.reduce((acc, l) => acc + (/(^|\s)Interop\s+PID:\s*\d+/i.test(l) ? 1 : 0), 0)
        if (count > 0) return String(count)
        // Fallback: detection found
        const found = lines.find(l => /Interop\s+Detection:\s*found/i.test(l))
        if (found) return '1'
        return null
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
        const m = findFirst(lines, [
          /audit\s*mode[:=\s]+(enabled|disabled|on|off|true|false)/i,
          /Auditmode:\s*(true|false|yes|no|on|off)/i,
        ])
        return m ? String(normalizeBool(m[1] as any)) : null
      }
      case 'AutoUpdate Enabled': {
        const m = findFirst(lines, [
          /^\S*\s*AutoUpdate:\s*(true|false|yes|no|on|off)/i,
          /(autoupdate|auto\s*update).*?(enabled|disabled|on|off|true|false)/i,
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
        const count = lines.reduce((acc, l) => acc + (/\bAdding\s+File\s+Extension:\s*\w+/i.test(l) ? 1 : 0), 0)
        if (count > 0) return String(count)
        const m = findFirst(lines, [
          /file\s*extensions?\s*added[:=\s]+(\d+)/i,
        ])
        return m ? String(m[1]) : null
      }
      case 'Publishers Loaded': {
        const count = lines.reduce((acc, l) => acc + (/\bLoading\s+Publisher:\s*/i.test(l) ? 1 : 0), 0)
        if (count > 0) return String(count)
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
        }
        return count > 0 ? String(count) : null
      }
      case 'Assembly Reflection Enabled': {
        const m = findFirst(lines, [
          /assembly\s*reflection.*?(enabled|disabled|on|off|true|false)/i,
          /Reflection\s*Enabled[:=\s]+(true|false|yes|no|on|off)/i,
        ])
        return m ? String(normalizeBool(m[1] as any)) : null
      }
      case 'Self Service Enabled': {
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
        // No reliable signal found
        return null
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
        return uniqNames.size > 0 ? String(uniqNames.size) : null
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
        // Linux: timestamped FILE CHECK lines indicate execs
        const execLinuxFileCheckStartRe = /^\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+FILE\s+CHECK\s+Filename=([^\s]+)/
        // Windows: SUCCESS lines
        const execWinRe = /Responding\s+to\s+Kernel\s*~\s*Filename:\s*([^~\r\n]+)\s*~\s*SUCCESS/i
        let linStart = 0, win = 0
        for (const l of lines) {
          if (execLinuxFileCheckStartRe.test(l)) linStart += 1
          if (execWinRe.test(l)) win += 1
        }
        const total = linStart > 0 ? linStart : (win > 0 ? win : 0)
        return total > 0 ? String(total) : null
      }
      case 'Top Executed File': {
        const execLinuxFileCheckStartRe = /^\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+FILE\s+CHECK\s+Filename=([^\s]+)/
        const execWinRe = /Responding\s+to\s+Kernel\s*~\s*Filename:\s*([^~\r\n]+)\s*~\s*SUCCESS/i
        const countsLinStart: Record<string, number> = {}
        const countsWin: Record<string, number> = {}
        let linStart = 0, win = 0
        for (const l of lines) {
          const mLS = l.match(execLinuxFileCheckStartRe)
          if (mLS) { linStart += 1; const key = mLS[1].trim(); countsLinStart[key] = (countsLinStart[key] ?? 0) + 1 }
          const mW = l.match(execWinRe)
          if (mW) { win += 1; const key = mW[1].trim(); countsWin[key] = (countsWin[key] ?? 0) + 1 }
        }
        const pick = linStart > 0 ? countsLinStart : (win > 0 ? countsWin : {})
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
      return '(?i)Loading\s+Publisher'
    case 'Path Exclusions':
      return '(?i)Loading\s+Path\s+Exclusion'
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
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return '(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS'
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
      return `(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS`
    }
    default:
      return null
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Preferred plain-text search tokens for filtering (non-regex)
export function getAirlockFieldSearchString(key: (typeof AIRLOCK_FIELDS)[number], data?: Record<(typeof AIRLOCK_FIELDS)[number], string>): string {
  switch (key) {
    case 'Airlock Version':
      return 'Starting Airlock Enforcement Agent'
    case 'Proxy Configured':
      return 'Proxy (not )?configured'
    case 'Primary Airlock Server':
      return 'Primary Airlock Server'
    case 'Interops Found':
      return 'Interop PID'
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
      return 'Policy Version:|/api/setpolicyver/|Policy Update.*current version is'
    case 'Audit Mode':
      return 'Auditmode:'
    case 'AutoUpdate Enabled':
      return 'AutoUpdate:'
    case 'Powershell Constrained Mode':
      return 'CONSTRAINED-MODE'
    case 'File Extensions Added':
      return 'Adding File Extension:'
    case 'Publishers Loaded':
      return 'Loading Publisher:'
    case 'Path Exclusions':
      return 'Loading Path Exclusion'
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
          if (fileOnly.startsWith('/')) return '(?i)FILE\\s+CHECK\\s+Filename='
          if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return '(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS'
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
            if (fileOnly.startsWith('/')) return '(?i)FILE\\s+CHECK\\s+Filename='
            if (/^[A-Za-z]:\\|^\\\\/.test(fileOnly)) return '(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:.*~\\s*SUCCESS'
          }
        }
        return '(?i)FILE\\s+CHECK\\s+Filename='
      }
      const fileOnly = v.replace(/\s*\(\d+\)\s*$/, '')
      if (fileOnly.startsWith('/')) return `(?i)FILE\\s+CHECK\\s+Filename=${escapeRegex(fileOnly)}`
      return `(?i)Responding\\s+to\\s+Kernel\\s*~\\s*Filename:\\s*${escapeRegex(fileOnly)}\\s*~\\s*SUCCESS`
    }
    default:
      return ''
  }
}
