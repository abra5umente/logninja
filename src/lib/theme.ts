// Theme and accent management functions

export function applyTheme(theme: 'light' | 'dark') {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }
}

export function applyAccent(accent: string) {
    document.documentElement.style.setProperty('--accent', accent)
}

export function getInitialTheme(): 'light' | 'dark' {
    try {
        const stored = localStorage.getItem('theme')
        if (stored === 'light' || stored === 'dark') return stored
    } catch { }
    return 'dark' // default
}

export function getInitialAccent(): string {
    try {
        const stored = localStorage.getItem('accent')
        if (stored) return stored
    } catch { }
    return '#30F24E' // default green
}

export function saveTheme(theme: 'light' | 'dark') {
    try {
        localStorage.setItem('theme', theme)
    } catch { }
}

export function saveAccent(accent: string) {
    try {
        localStorage.setItem('accent', accent)
    } catch { }
}