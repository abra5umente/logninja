import React, { useEffect, useMemo, useRef, useState } from 'react'
import { enablePizzaTheme } from '../lib/pizzaTheme'

export interface CommandItem {
  id: string
  label: string
  run: () => void
}

export default function CommandPalette({ open, onClose, items }: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[]
}) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 scrim" onClick={onClose}>
      <div className="popup w-[min(90vw,680px)] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="border-b border-line p-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const value = e.target.value
              setQuery(value)
              // Pizza easter egg trigger
              if (value.trim().toLowerCase() === 'pizza') {
                enablePizzaTheme()
              }
            }}
            onKeyDown={(e) => {
              // Enter runs the top match
              if (e.key === 'Enter' && filtered.length > 0) {
                e.preventDefault()
                filtered[0].run()
                onClose()
              }
            }}
            placeholder="type a command…"
            className="in"
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.map(i => (
            <button
              key={i.id}
              onClick={() => { i.run(); onClose() }}
              className="w-full text-left px-3 py-2 hover:bg-accent/10 hover:text-accent focus:bg-accent/10 outline-none"
            >
              {i.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="p-2">
              <div className="empty">
                <span className="kao">(・・ ) ?</span>
                no matching commands
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}