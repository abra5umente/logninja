import { LogLevel } from './types'

// Theme colour for each log level. Red, yellow and green keep their
// error / warning / ok meanings; DEBUG takes the secondary cyan.
export const LEVEL_COLOR_VAR: Record<LogLevel, string> = {
  ERROR: 'var(--red)',
  WARN: 'var(--yellow)',
  INFO: 'var(--green)',
  DEBUG: 'var(--cyan)',
  TRACE: 'var(--muted)',
  UNKNOWN: 'var(--muted)',
}

export const LEVEL_TEXT_CLASS: Record<LogLevel, string> = {
  ERROR: 'text-red',
  WARN: 'text-yellow',
  INFO: 'text-green',
  DEBUG: 'text-cyan',
  TRACE: 'text-muted',
  UNKNOWN: 'text-muted',
}

export function levelColorVar(level: string): string {
  return LEVEL_COLOR_VAR[level as LogLevel] ?? 'var(--muted)'
}

export function levelTextClass(level: string): string {
  return LEVEL_TEXT_CLASS[level as LogLevel] ?? 'text-muted'
}
