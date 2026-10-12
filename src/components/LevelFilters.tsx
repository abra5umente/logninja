import React from 'react'
import { LogLevel } from '../lib/types'
import { levelColorVar } from '../lib/levelColors'

const ALL_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'UNKNOWN']

interface Props {
  selectedLevels: LogLevel[] | null
  availableLevels: LogLevel[]
  onLevelClick: (lvl: LogLevel, isCtrlClick: boolean) => void
}

export default function LevelFilters({ selectedLevels, availableLevels, onLevelClick }: Props) {
  // Only render levels that exist in the data
  const levelsToRender = ALL_LEVELS.filter(lvl => availableLevels.includes(lvl))

  return (
    <div className="flex flex-col gap-1.5">
      {levelsToRender.map(lvl => {
        const isSelected = selectedLevels?.includes(lvl) ?? false
        const hasSelection = (selectedLevels?.length ?? 0) > 0

        return (
          <button
            key={lvl}
            onClick={(e) => onLevelClick(lvl, e.ctrlKey || e.metaKey)}
            className={`btn w-full flex items-center gap-2 text-left transition-opacity ${
              isSelected ? '!border-accent !bg-accent/15 font-semibold' : ''
            }`}
            style={{
              opacity: hasSelection && !isSelected ? 0.5 : 1
            }}
            aria-pressed={isSelected}
            title="Click to filter. Ctrl+click to select multiple levels."
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: levelColorVar(lvl) }} />
            {lvl}
          </button>
        )
      })}
      {levelsToRender.length === 0 && (
        <div className="empty text-xs">
          <span className="kao">(・・ ) ?</span>
          no log levels found
        </div>
      )}
    </div>
  )
}
