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

