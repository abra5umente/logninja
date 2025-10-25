import React, { useMemo, useState } from 'react'
import { FiltersState, LogEntry } from '../lib/types'
import { rowsToCSV, buildMarkdownSummary } from '../lib/export'

interface Props {
  rows: LogEntry[]
  filters: FiltersState
  bookmarked: LogEntry[]
  resetFilters: () => void
}

export default function ExportBar({ rows, filters, bookmarked, resetFilters }: Props) {
  const [mdOpen, setMdOpen] = useState(false)
  const csv = useMemo(() => rowsToCSV(rows, bookmarked), [rows, bookmarked])
  const md = useMemo(() => buildMarkdownSummary(rows, filters, bookmarked), [rows, filters, bookmarked])

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors"
          style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
            target.style.backgroundColor = accentColor;
            target.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = '';
            target.style.color = '';
          }}
          onClick={() => download(csv, 'logs.csv', 'text/csv;charset=utf-8')}
        >Export CSV</button>
        <button
          className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors"
          style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
            target.style.backgroundColor = accentColor;
            target.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = '';
            target.style.color = '';
          }}
          onClick={async () => { await copy(csv) }}
          title="Copy CSV to clipboard"
        >Copy CSV</button>
        <button
          className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors"
          style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
            target.style.backgroundColor = accentColor;
            target.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = '';
            target.style.color = '';
          }}
          onClick={() => setMdOpen(true)}
        >Markdown</button>
        <button
          className="px-2 py-1.5 text-xs bg-red-200 dark:bg-red-700 text-red-800 dark:text-red-200 rounded transition-colors"
          style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = '#ef4444'; // red-500
            target.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.backgroundColor = '';
            target.style.color = '';
          }}
          onClick={resetFilters}
        >Reset</button>
      </div>
      {mdOpen && (
        <MarkdownModal
          markdown={md}
          onClose={() => setMdOpen(false)}
          onCopy={copy}
          onDownload={() => download(md, 'log-summary.md', 'text/markdown;charset=utf-8')}
        />)
      }
    </div>
  )
}

function MarkdownModal({ markdown, onClose, onCopy, onDownload }: {
  markdown: string
  onClose: () => void
  onCopy: (text: string) => Promise<boolean>
  onDownload: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-md shadow-xl w-[min(90vw,900px)] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="font-semibold text-gray-800 dark:text-gray-100">Markdown Summary</div>
          <button 
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors hover:bg-[var(--accent)] hover:text-white"
            style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
            onMouseEnter={(e) => {
              const target = e.currentTarget;
              const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
              target.style.backgroundColor = accentColor;
              target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget;
              target.style.backgroundColor = '';
              target.style.color = '';
            }}
            onClick={onClose}
          >Close</button>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="flex-1" />
          <button
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors"
            style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
            onMouseEnter={(e) => {
              const target = e.currentTarget;
              const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
              target.style.backgroundColor = accentColor;
              target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget;
              target.style.backgroundColor = '';
              target.style.color = '';
            }}
            onClick={async () => { const ok = await onCopy(markdown); setCopied(ok); setTimeout(() => setCopied(false), 1200) }}
          >{copied ? 'Copied!' : 'Copy to Clipboard'}</button>
          <button
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded transition-colors"
            style={{ '--tw-shadow-color': 'var(--accent)' } as React.CSSProperties}
            onMouseEnter={(e) => {
              const target = e.currentTarget;
              const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
              target.style.backgroundColor = accentColor;
              target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget;
              target.style.backgroundColor = '';
              target.style.color = '';
            }}
            onClick={onDownload}
          >Download .md</button>
        </div>
        <div className="px-4 pb-4">
          <textarea
            readOnly
            className="w-full h-[60vh] font-mono text-sm p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            value={markdown}
          />
        </div>
      </div>
    </div>
  )
}
