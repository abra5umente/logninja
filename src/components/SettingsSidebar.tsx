import React, { useState, useEffect } from 'react'
import CreditsModal from './CreditsModal'
import GroupHeading from './GroupHeading'
import { PALETTES, PALETTE_LABELS, Palette, Scheme, SchemePref } from '../lib/theme'

interface SettingsSidebarProps {
    open: boolean
    onClose: () => void
    palette: Palette
    setPalette: (palette: Palette) => void
    schemePref: SchemePref
    setSchemePref: (pref: SchemePref) => void
    // The light/dark scheme in effect, used for the palette swatches
    scheme: Scheme
}

const SCHEMES: SchemePref[] = ['system', 'light', 'dark']

export default function SettingsSidebar({
    open,
    onClose,
    palette,
    setPalette,
    schemePref,
    setSchemePref,
    scheme
}: SettingsSidebarProps) {
    const [creditsOpen, setCreditsOpen] = useState(false)

    // ESC key handler
    useEffect(() => {
        if (!open) return

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [open, onClose])

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 scrim transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar */}
            <aside
                className={`fixed right-0 top-0 z-50 h-full w-[320px] sm:w-[360px] bg-surface border-l border-line-strong transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'
                    }`}
                role="dialog"
                aria-modal="true"
                aria-label="Settings"
            >
                {/* Header */}
                <div className="p-4 border-b border-line">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="font-extrabold text-accent">
                                settings
                            </h2>
                            <p className="text-xs text-muted mt-1">
                                client-side log viewer with search and filters
                            </p>
                        </div>
                        <button
                            className="btn subtle !p-1.5"
                            onClick={onClose}
                            aria-label="Close settings"
                            title="Close"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="w-4 h-4"
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
                        <GroupHeading title="appearance" />
                        <div className="seg full" role="radiogroup" aria-label="Light or dark">
                            {SCHEMES.map(s => (
                                <button
                                    key={s}
                                    className={schemePref === s ? 'on' : ''}
                                    onClick={() => setSchemePref(s)}
                                    role="radio"
                                    aria-checked={schemePref === s}
                                    title={s === 'system' ? 'Follow your device setting' : undefined}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Palette Section */}
                    <section>
                        <GroupHeading title="palette" />
                        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Palette">
                            {PALETTES.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPalette(p)}
                                    role="radio"
                                    aria-checked={palette === p}
                                    className={`flex items-center gap-3 px-2.5 py-2 rounded-inner border text-left transition-colors ${palette === p
                                        ? 'border-accent bg-accent/10'
                                        : 'border-line hover:border-line-strong'
                                        }`}
                                >
                                    {/* The swatch carries its own data-theme, so it shows that palette's colours */}
                                    <span
                                        data-theme={p}
                                        data-scheme={scheme}
                                        className="flex items-center gap-1 px-1.5 py-1 rounded-chip border border-line bg-bg"
                                        aria-hidden="true"
                                    >
                                        {['--accent', '--magenta', '--cyan', '--green', '--yellow', '--red'].map(v => (
                                            <span key={v} className="block w-2.5 h-2.5 rounded-full" style={{ background: `var(${v})` }} />
                                        ))}
                                    </span>
                                    <span className={palette === p ? 'text-fg font-semibold' : 'text-muted'}>{PALETTE_LABELS[p]}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Keymap Section */}
                    <section>
                        <GroupHeading title="keymap" />
                        <ul className="space-y-2 text-xs">
                            <li className="flex items-center justify-between">
                                <span className="text-muted">focus search</span>
                                <kbd>/</kbd>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-muted">command palette</span>
                                <span className="space-x-1">
                                    <kbd>ctrl</kbd>
                                    <span className="text-muted">/</span>
                                    <kbd>cmd</kbd>
                                    <span className="text-muted">+</span>
                                    <kbd>k</kbd>
                                </span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-muted">copy selected row</span>
                                <span className="space-x-1">
                                    <kbd>ctrl</kbd>
                                    <span className="text-muted">/</span>
                                    <kbd>cmd</kbd>
                                    <span className="text-muted">+</span>
                                    <kbd>c</kbd>
                                </span>
                            </li>
                            <li className="flex items-center justify-between">
                                <span className="text-muted">next / previous match</span>
                                <span className="space-x-1">
                                    <kbd>enter</kbd>
                                    <span className="text-muted">/</span>
                                    <kbd>shift</kbd>
                                    <span className="text-muted">+</span>
                                    <kbd>enter</kbd>
                                </span>
                            </li>
                        </ul>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-line flex items-center justify-between">
                    <a
                        href="https://github.com/abra5umente/logninja"
                        target="_blank"
                        rel="noreferrer"
                        className="link !text-xs"
                    >
                        logninja on github
                    </a>
                    <button
                        onClick={() => setCreditsOpen(true)}
                        className="link !text-xs !text-muted hover:!text-accent"
                    >
                        credits
                    </button>
                </div>
            </aside>

            {/* Credits Modal */}
            <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
        </>
    )
}
