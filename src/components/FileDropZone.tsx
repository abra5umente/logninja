import React, { useCallback, useRef, useState } from 'react'

interface Props {
  onText: (text: string, fileName: string) => void
}

export default function FileDropZone({ onText }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = '.log,.txt,.csv'

  async function decodeFile(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    // BOM checks
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return new TextDecoder('utf-8').decode(bytes.subarray(3))
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2))
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2))
    }
    // Heuristic for UTF-16 without BOM
    const sampleLen = Math.min(bytes.length, 4096)
    let nulCount = 0
    for (let i = 0; i < sampleLen; i++) if (bytes[i] === 0x00) nulCount++
    if (nulCount > sampleLen / 10) {
      return new TextDecoder('utf-16le').decode(bytes)
    }
    // Default to UTF-8
    return new TextDecoder('utf-8').decode(bytes)
  }

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setError(null)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    const f = files[0]
    if (!accept.split(',').some(ext => f.name.toLowerCase().endsWith(ext.replace('.', '')) || f.name.toLowerCase().endsWith(ext))) {
      // fallback check by extension
      const ok = /(\.log|\.txt|\.csv)$/i.test(f.name)
      if (!ok) {
        setError('Only .log, .txt, .csv files are supported')
        return
      }
    }
    try {
      const text = await decodeFile(f)
      onText(text, f.name)
    } catch (err) {
      setError('Failed to read file')
    }
  }, [onText])

  const onBrowse = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    try {
      const text = await decodeFile(f)
      onText(text, f.name)
    } catch {
      setError('Failed to read file')
    }
    e.target.value = ''
  }, [onText])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`w-full border-2 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'} rounded-md p-4 flex items-center justify-between gap-3`}
    >
      <div className="flex items-center gap-3">
        <div className="text-gray-600 dark:text-gray-300">
          <div className="font-medium">Drag & drop a log file</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Accepted: .log, .txt, .csv</div>
          {error && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => inputRef.current?.click()}
        >
          Browse…
        </button>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onBrowse} />
      </div>
    </div>
  )
}
