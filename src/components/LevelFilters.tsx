import React from 'react'
import { LogLevel } from '../lib/types'

const ALL_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']

interface Props {
  selectedLevels: LogLevel[] | null
  availableLevels: LogLevel[]
  onLevelClick: (lvl: LogLevel, isCtrlClick: boolean) => void
}

export default function LevelFilters({ selectedLevels, availableLevels, onLevelClick }: Props) {
  const colors: Record<string, string> = {
    ERROR: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-100',
    WARN: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100',
    INFO: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100',
    DEBUG: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100',
    TRACE: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100',
    UNKNOWN: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100',
  }

  const selectedColors: Record<string, string> = {
    ERROR: 'bg-red-600 text-white dark:bg-red-700',
    WARN: 'bg-amber-500 text-white dark:bg-amber-600',
    INFO: 'bg-blue-600 text-white dark:bg-blue-700',
    DEBUG: 'bg-gray-700 text-white dark:bg-gray-600',
    TRACE: 'bg-slate-700 text-white dark:bg-slate-600',
    UNKNOWN: 'bg-gray-700 text-white dark:bg-gray-600',
  }

  // Only render levels that exist in the data
  const levelsToRender = ALL_LEVELS.filter(lvl => availableLevels.includes(lvl))

  return (
    <div className="flex flex-col gap-2">
      {levelsToRender.map(lvl => {
        const isSelected = selectedLevels?.includes(lvl) ?? false
        const hasSelection = (selectedLevels?.length ?? 0) > 0

        return (
          <button
            key={lvl}
            onClick={(e) => onLevelClick(lvl, e.ctrlKey || e.metaKey)}
            className={`w-full px-3 py-2 text-xs font-medium rounded transition-all ${
              isSelected ? selectedColors[lvl] : colors[lvl]
            }`}
            style={{
              opacity: hasSelection && !isSelected ? 0.5 : 1
            }}
            title="Click to filter. Ctrl+click to select multiple levels."
          >
            {lvl}
          </button>
        )
      })}
      {levelsToRender.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          No log levels available
        </div>
      )}
    </div>
  )
}

