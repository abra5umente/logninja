// ASCII meters in the house theme style: ▰ for filled cells, ▱ for empty ones.

export const METER_CELLS = 16

export interface Meter {
  on: string
  off: string
  // the house theme colour step: '' (green), 'warn' over 65%, 'hot' over 85%
  level: '' | 'warn' | 'hot'
}

export function meter(fraction: number, cells = METER_CELLS): Meter {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
  // Anything above zero shows at least one cell so small counts stay visible
  const filled = f === 0 ? 0 : Math.max(1, Math.round(f * cells))
  return {
    on: '▰'.repeat(filled),
    off: '▱'.repeat(cells - filled),
    level: f > 0.85 ? 'hot' : f > 0.65 ? 'warn' : '',
  }
}
