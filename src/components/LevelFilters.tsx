import React from 'react'
import { LogLevel } from '../lib/types'

const LEVELS: Exclude<LogLevel, 'UNKNOWN'>[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

interface Props {
  selectedLevel: Exclude<LogLevel, 'UNKNOWN'> | null
  onSelect: (lvl: Exclude<LogLevel, 'UNKNOWN'> | null) => void
}

export default function LevelFilters({ selectedLevel, onSelect }: Props) {
  const colors: Record<string, string> = {
    ERROR: 'bg-red-100 text-red-700 hover:bg-red-200',
    WARN: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    INFO: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    DEBUG: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    TRACE: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  }
  
  const selectedColors: Record<string, string> = {
    ERROR: 'bg-red-600 text-white',
    WARN: 'bg-amber-500 text-white',
    INFO: 'bg-blue-600 text-white',
    DEBUG: 'bg-gray-700 text-white',
    TRACE: 'bg-slate-700 text-white',
  }
  
  return (
    <div className="flex items-center gap-2">
      {LEVELS.map(lvl => (
        <button
          key={lvl}
          onClick={() => onSelect(selectedLevel === lvl ? null : lvl)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors ${
            selectedLevel === lvl ? selectedColors[lvl] : colors[lvl]
          }`}
          title={selectedLevel === lvl ? `Clear ${lvl} filter` : `Filter to ${lvl} only`}
        >
          {lvl}
        </button>
      ))}
    </div>
  )
}

