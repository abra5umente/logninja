import React, { useMemo, useState } from 'react'
import { FiltersState, LogEntry } from '../lib/types'
import { rowsToCSV, buildMarkdownSummary } from '../lib/export'
import Modal from './Modal'

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
          className="btn"
          onClick={() => download(csv, 'logs.csv', 'text/csv;charset=utf-8')}
        >export csv</button>
        <button
          className="btn"
          onClick={async () => { await copy(csv) }}
          title="Copy CSV to clipboard"
        >copy csv</button>
        <button
          className="btn"
          onClick={() => setMdOpen(true)}
        >markdown</button>
        <button
          className="btn subtle danger"
          onClick={resetFilters}
          title="Clear every filter and the search"
        >reset filters</button>
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
    <Modal onClose={onClose}>
      <div className="popup w-[min(90vw,900px)] max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
          <div className="font-semibold flex-1">markdown summary</div>
          <button
            className="btn"
            onClick={async () => { const ok = await onCopy(markdown); setCopied(ok); setTimeout(() => setCopied(false), 1200) }}
          >{copied ? 'copied' : 'copy to clipboard'}</button>
          <button
            className="btn"
            onClick={onDownload}
          >download .md</button>
          <button
            className="btn subtle"
            onClick={onClose}
          >close</button>
        </div>
        <div className="p-4">
          <textarea
            readOnly
            className="in h-[60vh] resize-none"
            value={markdown}
          />
        </div>
      </div>
    </Modal>
  )
}
