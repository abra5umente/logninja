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
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center transition-all duration-500 ease-in-out ${
        isFading 
          ? 'opacity-0 transform -translate-y-full' 
          : 'opacity-100 transform translate-y-0'
      }`}
    >
      <div 
        className="max-w-4xl mx-auto text-white rounded-b-lg shadow-lg px-6 py-3"
        style={{ backgroundColor: 'var(--accent)', opacity: 0.8 }}
      >
        <div className="text-sm font-medium">
          ✓ {fileName} loaded in {loadTime.toFixed(2)}ms, {entriesCount.toLocaleString()} lines parsed
        </div>
      </div>
    </div>
  )
}
