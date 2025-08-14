import React, { useMemo, useState } from 'react'
import { FiltersState, LogEntry } from '../lib/types'
import { rowsToCSV, buildMarkdownSummary } from '../lib/export'

interface Props {
  rows: LogEntry[]
  filters: FiltersState
  bookmarked: LogEntry[]
}

export default function ExportBar({ rows, filters, bookmarked }: Props) {
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
    <div className="flex flex-wrap gap-2 items-center">
      <button
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={() => download(csv, 'logs.csv', 'text/csv;charset=utf-8')}
      >Export CSV</button>
      <button
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={async () => { await copy(csv) }}
        title="Copy CSV to clipboard"
      >Copy CSV</button>
      <button
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={() => setMdOpen(true)}
      >Markdown Summary</button>
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
      <div className="bg-white rounded-md shadow-xl w-[min(90vw,900px)] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-gray-800">Markdown Summary</div>
          <button className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100" onClick={onClose}>Close</button>
        </div>
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="flex-1" />
          <button
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={async () => { const ok = await onCopy(markdown); setCopied(ok); setTimeout(() => setCopied(false), 1200) }}
          >{copied ? 'Copied!' : 'Copy to Clipboard'}</button>
          <button
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={onDownload}
          >Download .md</button>
        </div>
        <div className="px-4 pb-4">
          <textarea
            readOnly
            className="w-full h-[60vh] font-mono text-sm p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-900"
            value={markdown}
          />
        </div>
      </div>
    </div>
  )
}
