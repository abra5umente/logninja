import type { LogEntry, SearchStep } from './types'

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildSearchRegex(query: string, useRegex: boolean): { re: RegExp | null } {
  const q = query.trim()
  if (!q) return { re: null }
  
  // Prevent extremely long patterns that could cause performance issues
  if (q.length > 1000) return { re: null }
  
  if (useRegex) {
    // Support PCRE-style (?i) for case-insensitive by removing it and adding 'i' flag.
    let pattern = q.replace(/\(\?i\)/gi, '')
    
    // Prevent patterns that could cause catastrophic backtracking
    if (pattern.includes('.*.*') || pattern.includes('++') || pattern.includes('**')) {
      return { re: null }
    }
    
    try {
      const regex = new RegExp(pattern, 'gi')
      
      // Test the regex on a small sample to detect potential issues
      try {
        regex.test('test')
      } catch {
        return { re: null }
      }
      
      return { re: regex }
    } catch {
      return { re: null }
    }
  }
  return { re: new RegExp(escapeRegExp(q), 'gi') }
}


/** The text a search runs against: displayed time, level and message, not the raw line */
export function searchText(e: Pick<LogEntry, 'timeStr' | 'level' | 'message'>): string {
  return `${e.timeStr} ${e.level} ${e.message}`
}

/**
 * A test for one search, or null when the query is empty. A regex that
 * buildSearchRegex refuses falls back to a plain case-insensitive contains.
 */
export function buildMatcher(query: string, useRegex: boolean): ((e: LogEntry) => boolean) | null {
  const q = query.trim()
  if (!q) return null
  const { re } = buildSearchRegex(q, useRegex)
  if (re) {
    const testRe = new RegExp(re.source, re.flags.replace('g', ''))
    return e => testRe.test(searchText(e))
  }
  const needle = q.toLowerCase()
  return e => searchText(e).toLowerCase().includes(needle)
}

/** The "search within" steps as one test, or null when there are none */
export function buildStepsMatcher(steps: SearchStep[]): ((e: LogEntry) => boolean) | null {
  const tests: ((e: LogEntry) => boolean)[] = []
  for (const step of steps) {
    const m = buildMatcher(step.query, step.useRegex)
    if (m) tests.push(step.exclude ? e => !m(e) : m)
  }
  if (tests.length === 0) return null
  return e => tests.every(t => t(e))
}

/**
 * Narrows rows one step at a time. counts[i] is how many rows are left after
 * step i, so each step can show what it kept.
 */
export function applySearchSteps(rows: LogEntry[], steps: SearchStep[]): { rows: LogEntry[]; counts: number[] } {
  const counts: number[] = []
  let current = rows
  for (const step of steps) {
    const m = buildMatcher(step.query, step.useRegex)
    if (m) current = current.filter(step.exclude ? e => !m(e) : m)
    counts.push(current.length)
  }
  return { rows: current, counts }
}

/** Adds a step for the current search, unless it is empty or the same step is already there */
export function addSearchStep(steps: SearchStep[], query: string, useRegex: boolean, exclude: boolean): SearchStep[] {
  const q = query.trim()
  if (!q) return steps
  if (steps.some(s => s.query === q && s.useRegex === useRegex && s.exclude === exclude)) return steps
  return [...steps, { query: q, useRegex, exclude }]
}

/** How a step reads in the breadcrumb and exports: `error`, `not /time(d )?out/` */
export function describeStep(step: SearchStep): string {
  const q = step.useRegex ? `/${step.query}/` : step.query
  return step.exclude ? `not ${q}` : q
}
