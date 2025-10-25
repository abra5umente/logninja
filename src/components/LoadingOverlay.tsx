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
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
        isVisible ? 'opacity-100 backdrop-blur-lg' : 'opacity-0 backdrop-blur-0'
      }`}
      style={{
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0)',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* LogNinja Logo */}
        <div
          className={`text-6xl font-bold tracking-wide transition-all duration-300 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          style={{
            color: 'var(--accent)',
            fontFamily: 'monospace'
          }}
        >
          logninja.
        </div>

        {/* Spinner or Checkmark */}
        <div className="relative h-16 w-16">
          {/* Spinner */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              showCheckmark ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <svg
              className="animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                style={{ color: 'var(--accent)' }}
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                style={{ color: 'var(--accent)' }}
              ></path>
            </svg>
          </div>

          {/* Checkmark */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
              showCheckmark ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
              className="w-16 h-16"
              style={{ color: 'var(--accent)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
        </div>

        {/* Loading Text */}
        <div
          className={`text-sm text-gray-300 dark:text-gray-400 transition-opacity duration-300 ${
            isVisible && !showCheckmark ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Loading {fileCount} {fileCount === 1 ? 'file' : 'files'}...
        </div>
      </div>
    </div>
  )
}
