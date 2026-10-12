import React, { useEffect, useState } from 'react'

interface Props {
  fileName: string
  loadTime: number
  entriesCount: number
  onClose: () => void
}

export default function LoadBanner({ fileName, loadTime, entriesCount, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFading(true)
    }, 2500)

    // Remove banner after 3 seconds
    const removeTimer = setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 3000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [onClose])

  if (!isVisible) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 flex justify-center pointer-events-none transition-all duration-500 ease-in-out ${
        isFading
          ? 'opacity-0 transform -translate-y-full'
          : 'opacity-100 transform translate-y-0'
      }`}
    >
      <div className="pill !cursor-default text-xs" role="status">
        <span className="dot" />
        <span>
          {fileName} loaded in <span className="text-accent tabular-nums">{loadTime.toFixed(2)}ms</span>
          <span className="dim">, {entriesCount.toLocaleString()} lines parsed</span>
        </span>
      </div>
    </div>
  )
}
