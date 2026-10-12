/**
 * The "what's new" notes and which of them this browser has already seen.
 * Only the id of the newest release seen is kept, in localStorage, so the
 * popup shows once per release and nothing leaves the browser.
 */

export interface WhatsNewItem {
  title: string
  body: string
}

export interface WhatsNewRelease {
  /** Stable id; a new id is what makes the popup show again */
  id: string
  /** Shown under the heading, e.g. "october 2026" */
  date: string
  title: string
  items: WhatsNewItem[]
}

/** Newest first. Add a release at the top to announce it. */
export const WHATS_NEW: WhatsNewRelease[] = [
  {
    id: '2026-10-v2',
    date: 'october 2026',
    title: 'logninja v2',
    items: [
      {
        title: 'airlock logs from every platform',
        body: 'Airlock 7.x debug logs from Windows, Linux and macOS agents now read properly, and the airlock summary fills in agent, host, policy and file check details for each. Click a value to jump to the lines behind it.',
      },
      {
        title: 'a fresh look',
        body: 'A new monospace theme with five palettes (tokyo night, catppuccin, rosé pine, gruvbox and kanagawa), each in light or dark, or following your device. Pick one in settings.',
      },
      {
        title: 'easier query builder',
        body: 'Hit "build query" and list the words a line should have (any or all of them) and the ones it shouldn\'t, with * as a wildcard and a live preview. Name a query to save it: it shows up under presets, and "edit query" reopens it.',
      },
      {
        title: 'simpler level filters',
        body: 'Click a level to turn it on or off, as many as you like. Ctrl/Cmd+click shows just that level.',
      },
      {
        title: 'the table fits the window',
        body: 'The log table now sizes itself to the window, so the column headings stay put and only the rows scroll.',
      },
    ],
  },
]

export const WHATS_NEW_KEY = 'logninja.whatsNewSeen'

/** The newest release, unless it is the one already seen */
export function unseenRelease(releases: WhatsNewRelease[], seenId: string | null): WhatsNewRelease | null {
  const latest = releases[0]
  if (!latest || latest.id === seenId) return null
  return latest
}

export function getSeenId(): string | null {
  try {
    return localStorage.getItem(WHATS_NEW_KEY)
  } catch {
    return null
  }
}

export function markSeen(id: string) {
  try {
    localStorage.setItem(WHATS_NEW_KEY, id)
  } catch { }
}
