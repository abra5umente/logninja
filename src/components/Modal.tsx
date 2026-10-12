import React from 'react'
import { createPortal } from 'react-dom'

// Modals render into <body>: .glass panels use backdrop-filter, which would
// otherwise trap a position: fixed overlay inside the panel.
export default function Modal({ onClose, children, align = 'center', z = 'z-50' }: {
  onClose: () => void
  children: React.ReactNode
  align?: 'center' | 'top'
  z?: string
}) {
  return createPortal(
    <div
      className={`fixed inset-0 ${z} flex justify-center p-4 scrim ${align === 'top' ? 'items-start pt-24' : 'items-center'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>,
    document.body
  )
}
