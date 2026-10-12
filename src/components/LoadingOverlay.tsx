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
    } else if (stage === 'complete') {
      // Show checkmark, hide spinner
      setShowCheckmark(true)
      // Wait a bit then start fade out
      const timer = setTimeout(() => {
        setIsVisible(false)
        // After fade out completes, notify parent
        setTimeout(onComplete, 500)
      }, 600)
      return () => clearTimeout(timer)
    }
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
