import React, { useEffect } from 'react'
import Modal from './Modal'
import type { WhatsNewRelease } from '../lib/whatsNew'

export default function WhatsNewModal({ release, onClose }: {
  release: WhatsNewRelease | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!release) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [release, onClose])

  if (!release) return null

  return (
    <Modal onClose={onClose} z="z-[60]">
      <div className="popup w-full max-w-lg max-h-[85vh] flex flex-col" role="dialog" aria-modal="true" aria-label="What's new">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-accent">what's new in {release.title}</h2>
            <div className="lbl mt-0.5">{release.date}</div>
          </div>
          <button className="btn subtle" onClick={onClose}>
            close <kbd className="ml-1">esc</kbd>
          </button>
        </div>
        <ul className="p-4 space-y-4 overflow-y-auto">
          {release.items.map(item => (
            <li key={item.title}>
              <div className="font-semibold text-fg">
                <span className="text-accent" aria-hidden="true">› </span>{item.title}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3">
          <span className="text-xs text-muted">reopen any time from settings</span>
          <button className="btn" onClick={onClose}>got it (•̀ᴗ•́)و</button>
        </div>
      </div>
    </Modal>
  )
}
