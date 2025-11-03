/**
 * Regex builder types and utilities for constructing regex patterns visually
 */

import { escapeRegExp as escapeRegex } from './search'
import { buildSearchRegex } from './search'

export type SegmentType = 'literal' | 'wildcard' | 'not' | 'custom'

export interface RegexSegment {
  id: string
  type: SegmentType
  value: string
  description?: string
}

// Counter for generating unique segment IDs
let segmentIdCounter = 0

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
      // Negative lookahead pattern
      // Improved to handle both single words and path segments better
      const escaped = escapeRegex(segment.value)

      // If value contains spaces or special chars, use a more flexible pattern
      if (/\s/.test(segment.value)) {
        // For multi-word exclusions: negative lookahead + match any non-slash/non-newline chars
        return `(?!${escaped})[^\\/\\r\\n]+`
      }

      // For single words/path segments: negative lookahead + word boundary + word chars
      // This works better for path components like "NOT abc" in "C:/Program Files/xyz/"
      return `(?!${escaped}(?:\\/|\\s|$))[^\\/\\s]+`
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
 * Returns empty string if validation fails
 */
export function buildRegexFromSegments(segments: RegexSegment[]): string {
  // Filter out invalid segments
  const validSegments = segments.filter(s => validateSegment(s).valid)

  if (validSegments.length === 0) return ''

  const pattern = validSegments.map(segmentToPattern).join('')

  // Validate the complete pattern for ReDoS risks using existing validation
  const validation = buildSearchRegex(pattern, true)

  return validation.re ? pattern : ''
}

/**
 * Validates a segment value based on its type
 */
export function validateSegment(segment: RegexSegment): { valid: boolean; error?: string } {
  if (!segment.value && segment.type !== 'wildcard') {
    return { valid: false, error: 'Value cannot be empty' }
  }

  if (segment.type === 'custom') {
    // Check for basic syntax errors
    try {
      new RegExp(segment.value)
    } catch (e) {
      return { valid: false, error: 'Invalid regex pattern' }
    }

    // Check for patterns that could cause catastrophic backtracking
    if (
      segment.value.includes('.*.*') ||
      segment.value.includes('++') ||
      segment.value.includes('**') ||
      /(\(.*\))[+*]\1/.test(segment.value) // Nested quantifiers like (a+)+
    ) {
      return {
        valid: false,
        error: 'Pattern may cause performance issues (ReDoS)',
      }
    }

    // Warn if pattern is very long
    if (segment.value.length > 500) {
      return { valid: false, error: 'Pattern too long (max 500 chars)' }
    }

    return { valid: true }
  }

  return { valid: true }
}

/**
 * Creates a default segment with unique counter-based ID
 */
export function createSegment(type: SegmentType = 'literal', value: string = ''): RegexSegment {
  return {
    id: `segment-${++segmentIdCounter}`,
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
