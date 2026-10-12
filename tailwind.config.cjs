// Colours come from the house theme (src/theme.css): only its named colours
// exist here, so a stray gray-700 or blue-500 fails to style anything.
// `bg-red/15` and friends become color-mix tints of the named colour.
const named = (name) => ({ opacityValue }) =>
  opacityValue === undefined || String(opacityValue).startsWith('var(')
    ? `var(--${name})`
    : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`

const MONO = ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-scheme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      bg: named('bg'),
      surface: named('surface'),
      fg: named('fg'),
      muted: named('muted'),
      accent: named('accent'),
      green: named('green'),
      yellow: named('yellow'),
      red: named('red'),
      magenta: named('magenta'),
      cyan: named('cyan'),
      line: 'var(--line)',
      'line-strong': 'var(--line-strong)',
    },
    fontFamily: {
      sans: MONO,
      mono: MONO,
    },
    extend: {
      borderColor: { DEFAULT: 'var(--line)' },
      ringColor: { DEFAULT: 'var(--accent)' },
      ringOffsetColor: { DEFAULT: 'var(--bg)' },
      borderRadius: { panel: '10px', inner: '7px', chip: '5px' },
    },
  },
  plugins: [],
}
