import { describe, expect, it } from 'vitest'
import { decodeBytes } from './decode'

const utf16le = (s: string) => {
  const out = new Uint8Array(s.length * 2)
  for (let i = 0; i < s.length; i++) { out[i * 2] = s.charCodeAt(i) & 0xff; out[i * 2 + 1] = s.charCodeAt(i) >> 8 }
  return out
}

describe('decodeBytes', () => {
  const line = '2026-01-05 10:00:00 INFO started'

  it('reads plain UTF-8', () => {
    expect(decodeBytes(new TextEncoder().encode(line))).toBe(line)
  })

  it('drops a UTF-8 byte order mark', () => {
    const bytes = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode(line)])
    expect(decodeBytes(bytes)).toBe(line)
  })

  it('reads UTF-16LE with a byte order mark', () => {
    expect(decodeBytes(new Uint8Array([0xFF, 0xFE, ...utf16le(line)]))).toBe(line)
  })

  it('reads UTF-16BE with a byte order mark', () => {
    const le = utf16le(line)
    const be = new Uint8Array(le.length)
    for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i] }
    expect(decodeBytes(new Uint8Array([0xFE, 0xFF, ...be]))).toBe(line)
  })

  it('spots UTF-16LE without a byte order mark', () => {
    expect(decodeBytes(utf16le(line))).toBe(line)
  })
})
