import { LogEntry, LogLevel } from './types'
import { escapeRegExp as escapeRe } from './search'

// Log patterns: lines that differ only in their variable parts (numbers, IPs, ids, paths...)
// collapse into one template such as "request completed in <n>ms". Only the first line of a
// message is used, so a stack trace groups by its exception line.

const PLACEHOLDER_NAMES = ['url', 'email', 'uuid', 'time', 'ip', 'mac', 'path', 'hex', 'id', 'n'] as const
export type Placeholder = (typeof PLACEHOLDER_NAMES)[number]

// One pass, leftmost match wins; at the same position the earlier alternative wins, so the
// specific shapes come before the bare number. Each alternative is one numbered group, in the
// order of PLACEHOLDER_NAMES and maskVariable's arguments (numbered rather than named groups:
// about twice as fast here).
const VARIABLE_RE = new RegExp([
  String.raw`\b[a-z][a-z0-9+.-]*://[^\s"'<>]+`,
  String.raw`\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b`,
  String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`,
  String.raw`\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b|\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\b`,
  String.raw`\b\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?\b`,
  String.raw`\b[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}\b`,
  // Windows paths may have spaces inside folder names, but not in the last part
  String.raw`\b[a-z]:\\(?:[^\\\r\n\t,;"'|<>]*\\)*[^\\\s,;"'|<>]*|(?<![\w.~])(?:~|\.{1,2})?(?:/[\w.@+~-]+)+/?`,
  String.raw`\b0x[0-9a-f]+\b|\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b`,
  // ids such as session tokens: 8+ characters mixing letters and digits
  String.raw`\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{8,}\b`,
  String.raw`(?<![\w.])-?\d+(?:\.\d+)*`,
].map(alt => `(${alt})`).join('|'), 'gi')

const MAX_TEMPLATE = 400

// Spelled out rather than (...groups): this runs for every variable in every line.
function maskVariable(m: string, url?: string, email?: string, uuid?: string, time?: string, ip?: string, mac?: string, path?: string, hex?: string, id?: string, n?: string): string {
  if (url !== undefined) return '<url>'
  if (email !== undefined) return '<email>'
  if (uuid !== undefined) return '<uuid>'
  if (time !== undefined) return '<time>'
  if (ip !== undefined) return '<ip>'
  if (mac !== undefined) return '<mac>'
  if (path !== undefined) return '<path>'
  if (hex !== undefined) return '<hex>'
  if (id !== undefined) return '<id>'
  if (n !== undefined) return '<n>'
  return m
}

// The trimmed first line of a message. A long one is cut to one character past what maskLine
// reads, so maskLine can tell it was cut.
function firstLine(message: string): string {
  const nl = message.indexOf('\n')
  const line = (nl >= 0 ? message.slice(0, nl) : message).trim()
  return line.length > MAX_TEMPLATE * 2 ? line.slice(0, MAX_TEMPLATE * 2 + 1) : line
}

// A cut template ends in "…", so its search matches rows that start the same rather than ending there
function maskLine(line: string): string {
  let cut = line.length > MAX_TEMPLATE * 2
  let t = (cut ? line.slice(0, MAX_TEMPLATE * 2) : line).replace(VARIABLE_RE, maskVariable)
  if (t.length > MAX_TEMPLATE) {
    // Don't leave half a placeholder ("<n") at the end: it would be searched for as text
    t = t.slice(0, MAX_TEMPLATE).replace(/<[a-z]*$/, '')
    cut = true
  }
  return cut ? t + '…' : t
}

export function templateOf(message: string): string {
  return maskLine(firstLine(message))
}

// Splits a template into literal text and placeholders, for rendering.
// Known gap: a line that literally contains "<id>", "<n>" etc. (usage text like "cmd <path>") reads
// as a placeholder here, so its pattern's search misses its own rows. Rare enough to leave for now.
export function templateParts(template: string): { text: string; placeholder: boolean }[] {
  const parts: { text: string; placeholder: boolean }[] = []
  const re = /<(url|email|uuid|time|ip|mac|path|hex|id|n)>/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index), placeholder: false })
    parts.push({ text: m[1], placeholder: true })
    last = m.index + m[0].length
  }
  if (last < template.length) parts.push({ text: template.slice(last), placeholder: false })
  return parts
}

// What each placeholder becomes in a search regex. These are looser than the masks, so the
// search finds every row of the pattern (and, rarely, a near neighbour).
const PLACEHOLDER_RE: Record<Placeholder, string> = {
  url: String.raw`\S+`,
  email: String.raw`\S+`,
  uuid: String.raw`[0-9a-f-]+`,
  time: String.raw`[\d:.,TZ+ -]+?`,
  ip: String.raw`[\d.:]+`,
  mac: String.raw`[0-9a-f:-]+`,
  path: '.+?',
  hex: String.raw`\w+`,
  id: String.raw`[\w-]+`,
  n: String.raw`-?[\d.]+`,
}

// A regex (for the search box) matching the rows of a pattern. Search runs against
// "time level message", so it is anchored to the start of the message (just after the level, or
// the start of the message cell when highlighting) and to the end of its first line.
const MESSAGE_START = String.raw`(?:^|(?<=(?:ERROR|WARN|INFO|DEBUG|TRACE|UNKNOWN) ))\s*`
export function templateToRegex(template: string): string {
  const truncated = template.endsWith('…')
  const body = templateParts(truncated ? template.slice(0, -1) : template)
    .map(p => (p.placeholder ? PLACEHOLDER_RE[p.text as Placeholder] : escapeRe(p.text)))
    .join('')
  let re = MESSAGE_START + body
  if (!truncated) re += String.raw`[^\S\n]*(?=\n|$)`
  // the search box refuses patterns over 1000 characters: keep the start, drop the anchor
  if (re.length > 990) {
    re = MESSAGE_START
    for (const p of templateParts(template)) {
      const piece = p.placeholder ? PLACEHOLDER_RE[p.text as Placeholder] : escapeRe(p.text)
      if (re.length + piece.length > 990) break
      re += piece
    }
  }
  return re
}

export const SPARK_BUCKETS = 24
const SPARK_CHARS = '▁▂▃▄▅▆▇█'

export interface Pattern {
  template: string
  count: number
  levelCounts: Partial<Record<LogLevel, number>>
  first: Date | null
  last: Date | null
  firstIndex: number
  firstRow: LogEntry
}

export type PatternSort = 'common' | 'rare' | 'errors' | 'latest'

// Grouping state, filled a slice of rows at a time so a huge file can be grouped without
// freezing the page (see groupRows), then ranked for display by rankPatterns.
export interface PatternGroups {
  patterns: Pattern[]
  byTemplate: Map<string, number>
  // pattern id for each row, by position in the rows array
  rowPattern: Int32Array
  done: number
  minT: number
  maxT: number
}

// Most logs repeat messages, so templates are cached by first line. The cache stops growing
// (rather than clearing) when full, so a file of all-unique lines doesn't churn it.
const templateCache = new Map<string, string>()
const TEMPLATE_CACHE_MAX = 100_000

function cachedTemplate(message: string): string {
  const line = firstLine(message)
  const hit = templateCache.get(line)
  if (hit !== undefined) return hit
  const t = maskLine(line)
  if (templateCache.size < TEMPLATE_CACHE_MAX) templateCache.set(line, t)
  return t
}

export function newPatternGroups(rowCount: number): PatternGroups {
  return { patterns: [], byTemplate: new Map(), rowPattern: new Int32Array(rowCount), done: 0, minT: Infinity, maxT: -Infinity }
}

// Groups rows[g.done .. g.done + count) into g. Returns true once every row is grouped.
export function groupRows(g: PatternGroups, rows: LogEntry[], count = rows.length): boolean {
  const end = Math.min(rows.length, g.done + count)
  for (let i = g.done; i < end; i++) {
    const e = rows[i]
    const tpl = cachedTemplate(e.message)
    let id = g.byTemplate.get(tpl)
    if (id === undefined) {
      id = g.patterns.length
      g.byTemplate.set(tpl, id)
      g.patterns.push({ template: tpl, count: 0, levelCounts: {}, first: null, last: null, firstIndex: e.index, firstRow: e })
    }
    g.rowPattern[i] = id
    const p = g.patterns[id]
    p.count++
    p.levelCounts[e.level] = (p.levelCounts[e.level] ?? 0) + 1
    if (e.time) {
      const t = e.time.getTime()
      if (!p.first || t < p.first.getTime()) p.first = e.time
      if (!p.last || t > p.last.getTime()) p.last = e.time
      if (t < g.minT) g.minT = t
      if (t > g.maxT) g.maxT = t
    }
  }
  g.done = end
  return end >= rows.length
}

const time = (d: Date | null) => (d ? d.getTime() : -Infinity)

export function sortPatterns(patterns: Pattern[], sort: PatternSort): Pattern[] {
  const list = patterns.slice()
  const err = (p: Pattern) => p.levelCounts.ERROR ?? 0
  const warn = (p: Pattern) => p.levelCounts.WARN ?? 0
  if (sort === 'common') list.sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
  else if (sort === 'rare') list.sort((a, b) => a.count - b.count || a.firstIndex - b.firstIndex)
  else if (sort === 'errors') list.sort((a, b) => err(b) - err(a) || warn(b) - warn(a) || b.count - a.count)
  else list.sort((a, b) => time(b.first) - time(a.first) || b.firstIndex - a.firstIndex)
  return list
}

// Sorts the patterns and works out sparklines (rows per slice of the time span) for the first
// `sparkFor` of them, since those are the ones that can be on screen.
export function rankPatterns(g: PatternGroups, rows: LogEntry[], sort: PatternSort, sparkFor = 300): { patterns: Pattern[]; sparks: Map<Pattern, number[]> } {
  const patterns = sortPatterns(g.patterns, sort)
  const sparks = new Map<Pattern, number[]>()
  if (g.minT === Infinity || sparkFor <= 0) return { patterns, sparks }
  const byId: (number[] | undefined)[] = new Array(g.patterns.length)
  for (const p of patterns.slice(0, sparkFor)) {
    const buckets = new Array(SPARK_BUCKETS).fill(0)
    sparks.set(p, buckets)
    byId[g.byTemplate.get(p.template)!] = buckets
  }
  const span = Math.max(1, g.maxT - g.minT + 1)
  for (let i = 0; i < g.done; i++) {
    const buckets = byId[g.rowPattern[i]]
    const t = rows[i].time
    if (!buckets || !t) continue
    buckets[Math.min(SPARK_BUCKETS - 1, Math.floor(((t.getTime() - g.minT) / span) * SPARK_BUCKETS))]++
  }
  return { patterns, sparks }
}

// Everything in one go, for small inputs and tests.
export function findPatterns(rows: LogEntry[], sort: PatternSort = 'common', sparkFor = 300) {
  const g = newPatternGroups(rows.length)
  groupRows(g, rows)
  return rankPatterns(g, rows, sort, sparkFor)
}

// Block-character sparkline, scaled to its own peak; empty slices are blank.
export function sparkline(buckets: number[]): string {
  let max = 0
  for (const b of buckets) if (b > max) max = b
  if (max === 0) return ' '.repeat(buckets.length)
  return buckets.map(b => (b === 0 ? ' ' : SPARK_CHARS[Math.min(7, Math.floor((b / max) * 7.999))])).join('')
}
