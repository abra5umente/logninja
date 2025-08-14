import React, { useEffect, useMemo, useRef, useState } from 'react'

export interface CommandItem {
  id: string
  label: string
  run: () => void
}

export default function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: CommandItem[] }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(i => i.label.toLowerCase().includes(q))
  }, [items, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div className="w-[min(90vw,680px)] bg-white dark:bg-gray-800 dark:text-gray-100 rounded-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 dark:border-gray-700 p-2">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="w-full px-3 py-2 text-sm bg-transparent outline-none"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.map(i => (
            <button
              key={i.id}
              onClick={() => { i.run(); onClose() }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {i.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-500">No matches</div>
          )}
        </div>
      </div>
    </div>
  )
}

