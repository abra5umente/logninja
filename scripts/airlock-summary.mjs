#!/usr/bin/env node
// Detects Airlock debug logs by filename and prints a two-column summary to stdout.
// Uses only Node.js standard library.

import fs from 'node:fs'
import path from 'node:path'

const FIELDS = [
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
  'Allowlist Browser Extensions loaded',
]

function isAirlockDebugFile(filePath) {
  const base = path.basename(filePath)
  return /^airlock\.\d+\.log$/i.test(base)
}

function normalizeBool(v) {
  if (v == null) return v
  const s = String(v).trim().toLowerCase()
  if (["true","yes","on","enabled"].includes(s)) return 'Yes'
  if (["false","no","off","disabled"].includes(s)) return 'No'
  return v
}

function findFirst(lines, regexes) {
  for (const re of regexes) {
    for (const line of lines) {
      const m = line.match(re)
      if (m) return m
    }
  }
  return null
}

function extract(fields, text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  const get = (key) => {
    switch (key) {
      case 'Airlock Version': {
        const m = findFirst(lines, [
          /airlock\s*(?:digital)?\s*(?:version|v)[:=\s]+([0-9]+(?:\.[0-9]+){1,3}(?:[-+][\w.]+)?)/i,
          /\bversion[:=\s]+([0-9]+(?:\.[0-9]+){1,3}(?:[-+][\w.]+)?)/i,
        ])
        return m ? m[1] : null
      }
      case 'Proxy Configured': {
        const m = findFirst(lines, [
          /proxy.*?(configured|enabled)[:=\s]+(true|false|yes|no|on|off)/i,
        ])
        return m ? normalizeBool(m[2] || m[1]) : null
      }
      case 'Primary Airlock Server': {
        const m = findFirst(lines, [
          /(primary\s*airlock\s*server|primary\s*server|server\s*(?:url|host))[:=\s]+([^\s,;]+)/i,
        ])
        return m ? m[2] : null
      }
      case 'Interops Found': {
        const m = findFirst(lines, [
          /interops?\s*(?:found|loaded)[:=\s]+(\d+)/i,
        ])
        return m ? m[1] : null
      }
      case 'Policy DB Loaded': {
        const m = findFirst(lines, [
          /policy\s*db.*loaded[:=\s]+(true|false|yes|no|on|off)/i,
          /loaded\s+policy\s+(?:database|db)/i,
        ])
        if (!m) return null
        return m[1] ? normalizeBool(m[1]) : 'Yes'
      }
      case 'Policy DB Version': {
        const m = findFirst(lines, [
          /policy\s*db\s*(?:version|ver)[:=\s]+([\w.-]+)/i,
        ])
        return m ? m[1] : null
      }
      case 'Audit Mode': {
        const m = findFirst(lines, [
          /audit\s*mode[:=\s]+(enabled|disabled|on|off|true|false)/i,
        ])
        return m ? normalizeBool(m[1]) : null
      }
      case 'AutoUpdate Enabled': {
        const m = findFirst(lines, [
          /(autoupdate|auto\s*update).*?(enabled|disabled|on|off|true|false)/i,
        ])
        return m ? normalizeBool(m[2]) : null
      }
      case 'Powershell Constrained Mode': {
        const m = findFirst(lines, [
          /powershell\s*constrained\s*mode[:=\s]+(enabled|disabled|on|off|true|false)/i,
        ])
        return m ? normalizeBool(m[1]) : null
      }
      case 'File Extensions Added': {
        const m = findFirst(lines, [
          /file\s*extensions?\s*added[:=\s]+(\d+)/i,
        ])
        return m ? m[1] : null
      }
      case 'Publishers Loaded': {
        const m = findFirst(lines, [
          /publishers?\s*(?:loaded|count)[:=\s]+(\d+)/i,
        ])
        return m ? m[1] : null
      }
      case 'Path Exclusions': {
        const m = findFirst(lines, [
          /path\s*exclusions?[:=\s]+(.+)/i,
        ])
        return m ? m[1].trim() : null
      }
      case 'Assembly Reflection Enabled': {
        const m = findFirst(lines, [
          /assembly\s*reflection.*?(enabled|disabled|on|off|true|false)/i,
        ])
        return m ? normalizeBool(m[1]) : null
      }
      case 'Self Service Enabled': {
        const m = findFirst(lines, [
          /self\s*service.*?(enabled|disabled|on|off|true|false)/i,
        ])
        return m ? normalizeBool(m[1]) : null
      }
      case 'Blocklist Metarules loaded': {
        const m = findFirst(lines, [
          /blocklist\s*metarules?\s*(?:loaded|count)[:=\s]+(\d+)/i,
        ])
        return m ? m[1] : null
      }
      case 'Allowlist Browser Extensions loaded': {
        const m = findFirst(lines, [
          /(allowlist|whitelist)?\s*browser\s*extensions?\s*(?:loaded|count)[:=\s]+(\d+)/i,
        ])
        return m ? m[2] : null
      }
      default:
        return null
    }
  }

  const result = {}
  for (const k of FIELDS) {
    const v = get(k)
    result[k] = v == null || String(v).trim() === '' ? '—' : String(v).trim()
  }
  return result
}

function main() {
  const file = process.argv[2]
  if (!file) return // no-op
  if (!isAirlockDebugFile(file)) return // not an airlock debug log; keep normal behaviour
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // can't read; print placeholders
  }
  const data = extract(FIELDS, text)
  // Print a simple two-column table
  console.log('Key | Value')
  console.log('---|---')
  for (const k of FIELDS) {
    console.log(`${k} | ${data[k]}`)
  }
}

main()

