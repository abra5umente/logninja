import React, { useEffect, useState } from 'react'

export default function BrandingBanner() {
    const [isTyping, setIsTyping] = useState(true)
    const [currentText, setCurrentText] = useState('')
    const fullText = 'logninja.'

    // Typing effect on first load (respects reduced motion)
    useEffect(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        if (prefersReducedMotion) {
            setCurrentText(fullText)
            setIsTyping(false)
            return
        }

        let index = 0
        const typeTimer = setInterval(() => {
            if (index <= fullText.length) {
                setCurrentText(fullText.slice(0, index))
                index++
            } else {
                setIsTyping(false)
                clearInterval(typeTimer)
            }
        }, 150)

        return () => clearInterval(typeTimer)
    }, [])

    return (
        <div
            className="fixed left-0 top-0 bottom-0 w-12 -z-10 flex items-center justify-center pointer-events-none select-none"
            style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed'
            }}
        >
            <div
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-wider opacity-5 dark:opacity-10"
                style={{
                    transform: 'rotate(180deg)',
                    color: 'var(--accent)',
                    fontFamily: 'monospace',
                    lineHeight: '1.2',
                    padding: '0.5rem 0'
                }}
            >
                {currentText}
                {isTyping && (
                    <span className="animate-pulse">|</span>
                )}
            </div>
        </div>
    )
}