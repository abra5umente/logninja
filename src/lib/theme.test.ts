import { describe, expect, it } from 'vitest'
import { isPalette, isSchemePref, resolveScheme } from './theme'

describe('theme', () => {
  it('resolves system to the device setting', () => {
    expect(resolveScheme('system', true)).toBe('light')
    expect(resolveScheme('system', false)).toBe('dark')
    expect(resolveScheme('dark', true)).toBe('dark')
    expect(resolveScheme('light', false)).toBe('light')
  })

  it('only accepts known palettes and schemes', () => {
    expect(isPalette('gruvbox')).toBe(true)
    expect(isPalette('#30F24E')).toBe(false)
    expect(isSchemePref('dark')).toBe(true)
    expect(isSchemePref('sepia')).toBe(false)
  })
})
