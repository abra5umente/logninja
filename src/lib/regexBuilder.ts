/**
 * Regex builder types and utilities for constructing regex patterns visually
 */

export type SegmentType = 'literal' | 'wildcard' | 'not' | 'custom'

export interface RegexSegment {
  id: string
  type: SegmentType
  value: string
  description?: string
}

/**
 * Escapes special regex characters in a literal string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Converts a segment to its regex pattern representation
 */
export function segmentToPattern(segment: RegexSegment): string {
  switch (segment.type) {
    case 'literal':
      return escapeRegex(segment.value)

    case 'wildcard':
      // Match anything (non-greedy by default for better control)
      return '.*?'

    case 'not': {
      // Negative lookahead + character class
      // For paths like "not abc", match anything except that exact string
      const escaped = escapeRegex(segment.value)
      // Match word boundaries or path separators to ensure we're not matching substrings
      return `(?!${escaped})[^\\s\\/]+`
    }

    case 'custom':
      // User-provided pattern (no escaping)
      return segment.value

    default:
      return escapeRegex(segment.value)
  }
}

/**
 * Builds a complete regex pattern from an array of segments
 */
export function buildRegexFromSegments(segments: RegexSegment[]): string {
  return segments.map(segmentToPattern).join('')
}

/**
 * Validates a segment value based on its type
 */
export function validateSegment(segment: RegexSegment): { valid: boolean; error?: string } {
  if (!segment.value && segment.type !== 'wildcard') {
    return { valid: false, error: 'Value cannot be empty' }
  }

  if (segment.type === 'custom') {
    try {
      new RegExp(segment.value)
      return { valid: true }
    } catch (e) {
      return { valid: false, error: 'Invalid regex pattern' }
    }
  }

  return { valid: true }
}

/**
 * Creates a default segment
 */
export function createSegment(type: SegmentType = 'literal', value: string = ''): RegexSegment {
  return {
    id: Math.random().toString(36).substring(2, 11),
    type,
    value,
  }
}

/**
 * Parses text into an initial literal segment
 */
export function parseInitialText(text: string): RegexSegment[] {
  if (!text) return []
  return [createSegment('literal', text)]
}

/**
 * Splits a segment at given indices
 * Example: "hello world" split at [0, 5] and [5, 11] -> ["hello", " world"]
 */
export function splitSegment(
  segment: RegexSegment,
  startOffset: number,
  endOffset: number
): { before?: RegexSegment; middle: RegexSegment; after?: RegexSegment } {
  const text = segment.value

  const result: { before?: RegexSegment; middle: RegexSegment; after?: RegexSegment } = {
    middle: createSegment(segment.type, text.slice(startOffset, endOffset)),
  }

  if (startOffset > 0) {
    result.before = createSegment(segment.type, text.slice(0, startOffset))
  }

  if (endOffset < text.length) {
    result.after = createSegment(segment.type, text.slice(endOffset))
  }

  return result
}
