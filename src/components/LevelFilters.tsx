import React from 'react'
import { LogLevel } from '../lib/types'

const LEVELS: Exclude<LogLevel, 'UNKNOWN'>[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

interface Props {
  active: Set<Exclude<LogLevel, 'UNKNOWN'>>
  onToggle: (lvl: Exclude<LogLevel, 'UNKNOWN'>) => void
}

export default function LevelFilters({ active, onToggle }: Props) {
  const colors: Record<string, string> = {
    ERROR: 'bg-red-100 text-red-700 data-[on=true]:bg-red-600 data-[on=true]:text-white',
    WARN: 'bg-amber-100 text-amber-700 data-[on=true]:bg-amber-500 data-[on=true]:text-white',
    INFO: 'bg-blue-100 text-blue-700 data-[on=true]:bg-blue-600 data-[on=true]:text-white',
    DEBUG: 'bg-gray-100 text-gray-700 data-[on=true]:bg-gray-700 data-[on=true]:text-white',
    TRACE: 'bg-slate-100 text-slate-700 data-[on=true]:bg-slate-700 data-[on=true]:text-white',
  }
  return (
    <div className="flex items-center gap-2">
      {LEVELS.map(lvl => (
        <button
          key={lvl}
          data-on={active.has(lvl)}
          onClick={() => onToggle(lvl)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded ${colors[lvl]}`}
          title={`Toggle ${lvl}`}
        >
          {lvl}
        </button>
      ))}
    </div>
  )
}

