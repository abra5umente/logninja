import React from 'react'

interface CreditsModalProps {
    open: boolean
    onClose: () => void
}

export default function CreditsModal({ open, onClose }: CreditsModalProps) {
    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 scrim"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="popup max-w-md w-full">
                {/* Header */}
                <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                    <h2 className="font-semibold">credits</h2>
                    <button className="btn subtle" onClick={onClose}>close</button>
                </div>

                {/* Content */}
                <div className="p-4">
                    <div className="lbl mb-2">assets &amp; resources</div>
                    <ul className="space-y-2">
                        <li>
                            <a
                                href="https://www.vecteezy.com/free-png/pizza"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link !text-[13px]"
                            >
                                Pizza PNGs by Vecteezy
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
