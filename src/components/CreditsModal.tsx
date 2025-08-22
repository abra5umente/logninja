import React from 'react'

interface CreditsModalProps {
    open: boolean
    onClose: () => void
}

export default function CreditsModal({ open, onClose }: CreditsModalProps) {
    if (!open) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/50 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Credits
                            </h2>
                            <button
                                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                onClick={onClose}
                                aria-label="Close credits"
                                title="Close"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="w-5 h-5"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        <div className="space-y-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                <h3 className="font-medium mb-2">Assets & Resources</h3>
                                <ul className="space-y-2">
                                    <li>
                                        <a
                                            href="https://www.vecteezy.com/free-png/pizza"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[var(--accent)] hover:underline"
                                        >
                                            Pizza PNGs by Vecteezy
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded border border-gray-300 dark:border-gray-600"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
