import React, { useState } from 'react'
import CreditsModal from './CreditsModal'

interface SettingsSidebarProps {
    open: boolean
    onClose: () => void
    theme: 'light' | 'dark'
    setTheme: (theme: 'light' | 'dark') => void
    accent: string
    setAccent: (accent: string) => void
}

const accentColors = [
    { label: 'Sage Green', value: '#9CAF88' },
    { label: 'Teal', value: '#14B8A6' },
    { label: 'Slate Blue', value: '#64748B' },
    { label: 'Dusty Rose', value: '#E5B8B8' },
    { label: 'Warm Amber', value: '#F59E0B' }
]

export default function SettingsSidebar({
    open,
    onClose,
    theme,
    setTheme,
    accent,
    setAccent
}: SettingsSidebarProps) {
    const [creditsOpen, setCreditsOpen] = useState(false)
    
    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar */}
            <aside
                className={`fixed right-0 top-0 z-50 h-full w-[320px] sm:w-[360px] bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'
                    }`}
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                                Settings
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Client-side log viewer with search and filters
                            </p>
                        </div>
                        <button
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={onClose}
                            aria-label="Close settings"
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
                <div className="p-4 space-y-6 overflow-y-auto flex-1">
                    {/* Appearance Section */}
                    <section>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Appearance
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setTheme('light')}
                                className={`flex-1 px-3 py-2 rounded border text-sm ${theme === 'light'
                                        ? 'border-[var(--accent)] text-[var(--accent)]'
                                        : 'border-gray-300 dark:border-gray-600'
                                    }`}
                            >
                                Light
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`flex-1 px-3 py-2 rounded border text-sm ${theme === 'dark'
                                        ? 'border-[var(--accent)] text-[var(--accent)]'
                                        : 'border-gray-300 dark:border-gray-600'
                                    }`}
                            >
                                Dark
                            </button>
                        </div>
                    </section>

                    {/* Accent Section */}
                    <section>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Accent
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {accentColors.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => setAccent(color.value)}
                                    className={`relative h-9 w-9 rounded-full border-2 transition ${accent === color.value
                                            ? 'border-[var(--accent)]'
                                            : 'border-transparent'
                                        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)]`}
                                    style={{ backgroundColor: color.value }}
                                    aria-label={`${color.label} accent`}
                                >
                                    {accent === color.value && (
                                        <span className="absolute inset-0 rounded-full ring-2 ring-white dark:ring-black" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Keymap Section */}
                    <section>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Keymap
                        </h3>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Focus Search</span>
                                <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                    /
                                </kbd>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Command Palette</span>
                                <span className="space-x-1">
                                    <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        Ctrl
                                    </kbd>
                                    <span className="text-gray-400">/</span>
                                    <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        Cmd
                                    </kbd>
                                    <span className="ml-1">+</span>
                                    <kbd className="ml-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        K
                                    </kbd>
                                </span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-300">Copy Selected Row</span>
                                <span>
                                    <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        Ctrl
                                    </kbd>
                                    <span className="mx-1">/</span>
                                    <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        Cmd
                                    </kbd>
                                    <span className="ml-1">+</span>
                                    <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        C
                                    </kbd>
                                </span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">LogNinja v0.6.0</span>
                        <button
                            onClick={() => setCreditsOpen(true)}
                            className="text-xs text-gray-500 hover:text-[var(--accent)] transition-colors"
                        >
                            Credits
                        </button>
                    </div>
                    <a
                        href="https://github.com/abra5umente/logninja"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium"
                        style={{ color: 'var(--accent)' }}
                    >
                        GitHub
                    </a>
                </div>
            </aside>
            
            {/* Credits Modal */}
            <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
        </>
    )
}