import { LogLevel } from './types'

// Next level selection after clicking a level button. A plain click toggles
// the level on or off; Ctrl/Cmd+click shows only that level (or clears the
// filter if it was already the only one). An empty selection means "all".
export function nextLevelSelection(
  current: LogLevel[] | null,
  level: LogLevel,
  only: boolean
): LogLevel[] | null {
  const selected = current ?? []
  if (only) {
    return selected.length === 1 && selected[0] === level ? null : [level]
  }
  const next = selected.includes(level)
    ? selected.filter(l => l !== level)
    : [...selected, level]
  return next.length > 0 ? next : null
}
