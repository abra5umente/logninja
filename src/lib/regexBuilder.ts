/**
 * Query builder: turns a list of plain-language terms into one search regex.
 *
 * A query is a set of terms the line must have ("any" or "all" of them) plus
 * terms it must not have. Text terms are matched literally except `*`, which
 * matches anything on the same line; regex terms are used as written.
 *
 * The pattern matches the wanted terms themselves, so they get highlighted,
 * and puts the "all of" / "none of" checks in a lookbehind anchored at the
 * start of the searched text: `(?:a|b)(?<=^(?=…a)(?=…b)(?!…x)[\s\S]*)`.
 */

import { escapeRegExp, buildSearchRegex } from './search'

export type TermKind = 'text' | 'regex'
export type MatchMode = 'any' | 'all'

export interface QueryTerm {
  id: string
  value: string
  kind: TermKind
}

export interface BuilderQuery {
  mode: MatchMode
  include: QueryTerm[]
  exclude: QueryTerm[]
}

const MAX_PATTERN_LENGTH = 1000
const MAX_REGEX_TERM_LENGTH = 500

let termIdCounter = 0

export function createTerm(value = '', kind: TermKind = 'text'): QueryTerm {
  return { id: `term-${++termIdCounter}`, value, kind }
}

export function emptyQuery(): BuilderQuery {
  return { mode: 'any', include: [createTerm()], exclude: [] }
}

function isBlank(term: QueryTerm): boolean {
  return term.value.trim() === ''
}

/** Strips PCRE-style (?i), which the search adds as a flag anyway */
function stripInlineFlags(s: string): string {
  return s.replace(/\(\?i\)/gi, '')
}

export function termToPattern(term: QueryTerm): string {
  if (term.kind === 'regex') return `(?:${stripInlineFlags(term.value)})`
  // Escape everything, then turn each run of escaped * back into "anything"
  return escapeRegExp(term.value).replace(/(?:\\\*)+/g, '.*?')
}

export function validateTerm(term: QueryTerm): { valid: boolean; error?: string } {
  if (isBlank(term)) return { valid: false, error: 'empty' }

  if (term.kind === 'text') {
    if (term.value.replace(/[*\s]/g, '') === '') {
      return { valid: false, error: 'needs some text besides *' }
    }
    return { valid: true }
  }

  const value = stripInlineFlags(term.value)
  if (value.length > MAX_REGEX_TERM_LENGTH) {
    return { valid: false, error: `too long (max ${MAX_REGEX_TERM_LENGTH} characters)` }
  }
  try {
    new RegExp(value)
  } catch {
    return { valid: false, error: 'not a valid regex' }
  }
  if (
    value.includes('.*.*') ||
    value.includes('++') ||
    value.includes('**') ||
    /(\(.*\))[+*]\1/.test(value)
  ) {
    return { valid: false, error: 'could be very slow (nested repeats)' }
  }
  return { valid: true }
}

export interface BuildResult {
  pattern: string
  error?: string
}

/**
 * Builds the search pattern. Blank terms are ignored; an invalid term makes
 * the whole query invalid so a half-typed regex never reaches the search.
 */
export function buildPattern(query: BuilderQuery): BuildResult {
  const include = query.include.filter(t => !isBlank(t))
  const exclude = query.exclude.filter(t => !isBlank(t))

  for (const t of [...include, ...exclude]) {
    const v = validateTerm(t)
    if (!v.valid) return { pattern: '', error: `"${t.value}": ${v.error}` }
  }
  if (include.length === 0 && exclude.length === 0) return { pattern: '' }

  const inc = include.map(termToPattern)
  const exc = exclude.map(termToPattern)

  let guard = ''
  if (query.mode === 'all' && inc.length > 1) {
    guard += inc.map(p => `(?=[\\s\\S]*?${p})`).join('')
  }
  if (exc.length > 0) {
    guard += `(?![\\s\\S]*?(?:${exc.join('|')}))`
  }

  let pattern: string
  if (inc.length === 0) {
    // Only exclusions: an empty match at the start of every line that has none of them
    pattern = `^${guard}`
  } else {
    const core = inc.length === 1 ? inc[0] : `(?:${inc.join('|')})`
    pattern = guard ? `${core}(?<=^${guard}[\\s\\S]*)` : inc.join('|')
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { pattern: '', error: `query is too long (max ${MAX_PATTERN_LENGTH} characters of regex)` }
  }
  if (!buildSearchRegex(pattern, true).re) {
    return { pattern: '', error: 'the search would reject this pattern' }
  }
  return { pattern }
}

const REGEX_META = /[\\^$.*+?()[\]{}]/

/** Splits on | that isn't escaped or inside a group or character class */
function splitTopLevelAlternation(s: string): string[] | null {
  const parts: string[] = []
  let depth = 0
  let inClass = false
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { i++; continue }
    if (inClass) { if (c === ']') inClass = false; continue }
    if (c === '[') inClass = true
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === '|' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1 }
    if (depth < 0) return null
  }
  parts.push(s.slice(start))
  return parts
}

/** True when the outer ( ) wrap the whole string as one group */
function isWrappedInGroup(s: string): boolean {
  if (!s.startsWith('(') || !s.endsWith(')') || s.startsWith('(?')) return false
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') { i++; continue }
    if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0 && i < s.length - 1) return false }
  }
  return depth === 0
}

/**
 * Turns whatever is in the search box into a starting point for the builder.
 * A regex made only of plain words joined by | (like the presets) becomes one
 * text term per word; any other regex becomes a single regex term.
 */
export function queryFromSearch(search: string, useRegex: boolean): BuilderQuery {
  const q = search.trim()
  if (!q) return emptyQuery()
  if (!useRegex) return { mode: 'any', include: [createTerm(q)], exclude: [] }

  let body = stripInlineFlags(q)
  if (isWrappedInGroup(body)) body = body.slice(1, -1)
  const parts = splitTopLevelAlternation(body)
  if (parts && parts.length > 1 && parts.every(p => p.trim() && !REGEX_META.test(p))) {
    return { mode: 'any', include: parts.map(p => createTerm(p)), exclude: [] }
  }
  return { mode: 'any', include: [createTerm(q, 'regex')], exclude: [] }
}

/** Fresh ids, so an opened copy never shares term ids with another one */
export function cloneQuery(query: BuilderQuery): BuilderQuery {
  return {
    mode: query.mode,
    include: query.include.map(t => createTerm(t.value, t.kind)),
    exclude: query.exclude.map(t => createTerm(t.value, t.kind)),
  }
}
