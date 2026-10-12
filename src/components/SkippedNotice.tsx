import React, { useEffect } from 'react'

// Says which files a load skipped because they weren't text (a .gz next to rotated logs, say).
// Clears itself after a few seconds, or on click.
export default function SkippedNotice({ names, onClose }: { names: string[]; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [names, onClose])

  return (
    <div className="fixed top-14 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
      <button type="button" className="error text-xs text-left max-w-[min(90vw,640px)] pointer-events-auto" onClick={onClose} role="alert" title="Dismiss">
        <span className="kao">(╥﹏╥)</span>
        skipped {names.length === 1 ? 'a file that isn’t' : `${names.length} files that aren’t`} plain text
        <small className="truncate">{names.join(', ')}</small>
      </button>
    </div>
  )
}
