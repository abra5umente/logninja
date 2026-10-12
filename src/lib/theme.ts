// Theme management for the house theme (src/theme.css).
// The palette goes on <html> as data-theme, light/dark as data-scheme.
// index.html runs the same logic inline before first paint, so keep the two in step.

export const PALETTES = ['tokyo', 'catppuccin', 'rosepine', 'gruvbox', 'kanagawa'] as const
export type Palette = (typeof PALETTES)[number]

export const PALETTE_LABELS: Record<Palette, string> = {
    tokyo: 'tokyo night',
    catppuccin: 'catppuccin',
    rosepine: 'rosé pine',
    gruvbox: 'gruvbox',
    kanagawa: 'kanagawa',
}

// 'system' follows the device's light/dark setting
export type SchemePref = 'system' | 'light' | 'dark'
export type Scheme = 'light' | 'dark'

export function isPalette(v: unknown): v is Palette {
    return typeof v === 'string' && (PALETTES as readonly string[]).includes(v)
}

export function isSchemePref(v: unknown): v is SchemePref {
    return v === 'system' || v === 'light' || v === 'dark'
}

export function resolveScheme(pref: SchemePref, systemPrefersLight: boolean): Scheme {
    if (pref === 'system') return systemPrefersLight ? 'light' : 'dark'
    return pref
}

const lightQuery = () => window.matchMedia('(prefers-color-scheme: light)')

export function systemPrefersLight(): boolean {
    try { return lightQuery().matches } catch { return false }
}

// Calls back whenever the device switches between light and dark
export function watchSystemScheme(onChange: () => void): () => void {
    try {
        const m = lightQuery()
        m.addEventListener('change', onChange)
        return () => m.removeEventListener('change', onChange)
    } catch {
        return () => {}
    }
}

export function applyTheme(palette: Palette, scheme: Scheme) {
    const root = document.documentElement
    root.dataset.theme = palette
    root.dataset.scheme = scheme
    // Browser chrome (mobile address bar etc.) follows the page background
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta && bg) meta.setAttribute('content', bg)
}

export function getInitialPalette(): Palette {
    try {
        const stored = localStorage.getItem('palette')
        if (isPalette(stored)) return stored
    } catch { }
    return 'tokyo'
}

export function getInitialSchemePref(): SchemePref {
    try {
        const stored = localStorage.getItem('theme')
        if (isSchemePref(stored)) return stored
    } catch { }
    return 'system'
}

export function savePalette(palette: Palette) {
    try {
        localStorage.setItem('palette', palette)
    } catch { }
}

export function saveSchemePref(pref: SchemePref) {
    try {
        localStorage.setItem('theme', pref)
    } catch { }
}
