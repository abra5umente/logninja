import React from 'react'

export type CenterView = 'rows' | 'patterns'

// rows / patterns toggle shown in the header of both the log table and the patterns panel
export default function ViewSwitch({ view, onChange }: { view: CenterView; onChange: (v: CenterView) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Show rows or patterns">
      {(['rows', 'patterns'] as const).map(v => (
        <button
          key={v}
          className={`!py-1 ${view === v ? 'on' : ''}`}
          onClick={() => onChange(v)}
          role="radio"
          aria-checked={view === v}
          title={v === 'rows' ? 'Every log line' : 'Similar lines grouped together'}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
