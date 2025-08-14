import React from 'react'

type Preset = { label: string; pattern: string }

const PRESETS: Preset[] = [
  { label: 'PowerShell suspicious', pattern: '(?i)(Add-MpPreference|Bypass|EncodedCommand|IEX)' },
  { label: 'Windows crash keywords', pattern: 'faulting module|exception code|stack trace' },
  { label: 'Airlock Digital terms', pattern: 'Airlock|Trusted Application|Publisher' },
]

interface Props {
  onSelect: (pattern: string) => void
}

export default function PresetsDropdown({ onSelect }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 dark:text-gray-300">Presets</label>
      <select
        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value
          if (v) onSelect(v)
          e.currentTarget.value = ''
        }}
      >
        <option value="" disabled>Choose…</option>
        {PRESETS.map(p => (
          <option key={p.label} value={p.pattern}>{p.label}</option>
        ))}
      </select>
    </div>
  )
}
