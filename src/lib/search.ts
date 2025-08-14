export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildSearchRegex(query: string, useRegex: boolean): { re: RegExp | null } {
  const q = query.trim()
  if (!q) return { re: null }
  if (useRegex) {
    // Support PCRE-style (?i) for case-insensitive by removing it and adding 'i' flag.
    let pattern = q.replace(/\(\?i\)/gi, '')
    try {
      return { re: new RegExp(pattern, 'gi') }
    } catch {
      return { re: null }
    }
  }
  return { re: new RegExp(escapeRegExp(q), 'gi') }
}

