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

        // Start with first character immediately visible
        let index = 1
        setCurrentText(fullText.slice(0, 1))

        const typeTimer = setInterval(() => {
            if (index < fullText.length) {
                index++
                setCurrentText(fullText.slice(0, index))
            } else {
                setIsTyping(false)
                clearInterval(typeTimer)
            }
        }, 150)

        return () => clearInterval(typeTimer)
    }, [])

    return (
        <div
            className="fixed left-4 top-4 z-10 pointer-events-none select-none"
        >
            <div
                className="text-2xl md:text-3xl font-extrabold tracking-tight text-muted opacity-40"
            >
                {currentText}
                {isTyping && (
                    <span className="animate-pulse">|</span>
                )}
            </div>
        </div>
    )
}