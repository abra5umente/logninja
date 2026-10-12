import React, { useEffect, useState } from 'react'

interface Props {
  stage: 'loading' | 'complete' | 'idle'
  fileCount: number
  onComplete: () => void
}

export default function LoadingOverlay({ stage, fileCount, onComplete }: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const [showCheckmark, setShowCheckmark] = useState(false)

  useEffect(() => {
    if (stage === 'loading') {
      setIsVisible(true)
      setShowCheckmark(false)
      return
    }
    if (stage === 'complete') {
      // Show checkmark, then fade out and tell the parent. Both timers are cleared if another load
      // starts meanwhile, or a stale one would end the new load and leave the overlay stuck on screen.
      setShowCheckmark(true)
      let doneTimer: ReturnType<typeof setTimeout> | undefined
      const fadeTimer = setTimeout(() => {
        setIsVisible(false)
        doneTimer = setTimeout(onComplete, 500)
      }, 600)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(doneTimer)
      }
    }
    setIsVisible(false)
  }, [stage, onComplete])

  if (stage === 'idle' && !isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center scrim transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div
        className={`popup px-12 py-8 flex flex-col items-center gap-3 transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-95'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="text-4xl font-extrabold tracking-tight text-accent">
          logninja.
        </div>

        {/* Kaomoji: waiting while loading, ready when done */}
        <div className="kao text-base h-6">
          {showCheckmark ? '(｀・ω・´)' : '(￣～￣;)'}
        </div>

        <div className="text-xs text-muted">
          {showCheckmark
            ? 'ready'
            : `loading ${fileCount} ${fileCount === 1 ? 'file' : 'files'}…`}
        </div>
      </div>
    </div>
  )
}
