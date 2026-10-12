import { describe, expect, it } from 'vitest'
import { WHATS_NEW, unseenRelease, type WhatsNewRelease } from './whatsNew'

const rel = (id: string): WhatsNewRelease => ({ id, date: '', title: id, items: [] })

describe('whatsNew', () => {
  it('shows the newest release when nothing has been seen', () => {
    expect(unseenRelease([rel('b'), rel('a')], null)?.id).toBe('b')
  })

  it('stays hidden once the newest release has been seen', () => {
    expect(unseenRelease([rel('b'), rel('a')], 'b')).toBeNull()
  })

  it('shows again when a newer release is added', () => {
    expect(unseenRelease([rel('c'), rel('b'), rel('a')], 'b')?.id).toBe('c')
  })

  it('shows nothing when there are no notes', () => {
    expect(unseenRelease([], null)).toBeNull()
  })

  it('has unique ids and something to say in each release', () => {
    const ids = WHATS_NEW.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of WHATS_NEW) expect(r.items.length).toBeGreaterThan(0)
  })
})
