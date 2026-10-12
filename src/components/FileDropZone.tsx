import React, { useCallback, useRef, useState } from 'react'

interface Props {
  onText: (text: string, fileName: string) => void
}

export default function FileDropZone({ onText }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
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
    setIsLoading(true)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) {
      setIsLoading(false)
      return
    }

    // Accumulate errors instead of overwriting
    const errors: string[] = []

    // Process each file
    for (const f of files) {
      if (!accept.split(',').some(ext => f.name.toLowerCase().endsWith(ext.replace('.', '')) || f.name.toLowerCase().endsWith(ext))) {
        // fallback check by extension
        const ok = /(\.log|\.txt|\.csv)$/i.test(f.name)
        if (!ok) {
          errors.push(`${f.name} (unsupported format)`)
          continue
        }
      }
      try {
        const text = await decodeFile(f)
        onText(text, f.name)
      } catch (err) {
        errors.push(`${f.name} (read failed)`)
      }
    }

    if (errors.length > 0) {
      setError(`Skipped ${errors.length} file${errors.length > 1 ? 's' : ''}: ${errors.join(', ')}`)
    }

    setIsLoading(false)
  }, [onText, accept])

  const onBrowse = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setError(null)
    setIsLoading(true)

    // Accumulate errors instead of overwriting
    const errors: string[] = []

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      try {
        const text = await decodeFile(f)
        onText(text, f.name)
      } catch {
        errors.push(`${f.name} (read failed)`)
      }
    }

    if (errors.length > 0) {
      setError(`Failed to read ${errors.length} file${errors.length > 1 ? 's' : ''}: ${errors.join(', ')}`)
    }

    e.target.value = ''
    setIsLoading(false)
  }, [onText])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`w-full border-2 border-dashed ${isDragging ? 'border-accent bg-accent/10' : 'border-line-strong bg-bg/45'} rounded-panel p-4 flex items-center justify-between gap-3`}
    >
      <div className="flex items-center gap-3">
        <div>
          <div className="font-semibold">
            {isLoading ? 'loading files…' : 'drag & drop log files (multiple supported)'}
          </div>
          <div className="text-xs text-muted">.log, .txt or .csv</div>
          {error && <div className="error mt-2 text-xs"><span className="kao">(╥﹏╥)</span>{error}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isLoading && (
          <span className="kao">(￣～￣;)</span>
        )}
        <button
          className="btn primary"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
        >
          browse…
        </button>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={onBrowse} disabled={isLoading} />
      </div>
    </div>
  )
}
