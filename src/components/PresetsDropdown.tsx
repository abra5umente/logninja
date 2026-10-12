import React from 'react'
import { useSavedQueries } from '../lib/savedQueries'

type Preset = { label: string; pattern: string }

const PRESETS: Preset[] = [
  { label: 'PowerShell suspicious', pattern: '(?i)(Add-MpPreference|Bypass|EncodedCommand|IEX)' },
  { label: 'Windows crash keywords', pattern: 'faulting module|exception code|stack trace' },
  { label: 'Airlock Digital terms', pattern: 'Airlock|Trusted Application|Publisher' },
]

interface Props {
  onSelect: (pattern: string) => void
}

// Option values are "preset:<i>" / "saved:<id>" so two entries with the same
// regex stay distinct.
export default function PresetsDropdown({ onSelect }: Props) {
  const saved = useSavedQueries()

  return (
    <div className="flex items-center gap-2">
      <label className="lbl">presets</label>
      <select
        className="in"
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value
          e.currentTarget.value = ''
          if (v.startsWith('preset:')) {
            const p = PRESETS[Number(v.slice(7))]
            if (p) onSelect(p.pattern)
          } else if (v.startsWith('saved:')) {
            const s = saved.find(x => x.id === v.slice(6))
            if (s) onSelect(s.pattern)
          }
        }}
      >
        <option value="" disabled>choose…</option>
        {saved.length > 0 && (
          <optgroup label="my saved queries">
            {saved.map(s => (
              <option key={s.id} value={`saved:${s.id}`}>{s.name}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="built-in">
          {PRESETS.map((p, i) => (
            <option key={p.label} value={`preset:${i}`}>{p.label}</option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
