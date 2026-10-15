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
    id: '2026-10-15',
    date: '15 october 2026',
    title: 'logninja',
    items: [
      {
        title: 'search, then search again',
        body: 'Type a search and hit "search within these" (or Ctrl+Enter) to keep just those rows, then search again inside them. "Hide these" (Ctrl+Shift+Enter) drops the matches instead, handy for clearing out noise. Your steps stack up above the search box with a count for each: click one to go back to it, or × to remove it.',
      },
      {
        title: 'your time or the log\'s',
        body: 'A "local / as logged" switch above the table shows times in your own time zone or on the clock each line was written in. The timeline, search, time range and exports all follow it.',
      },
      {
        title: 'really big logs',
        body: 'Logs with more than a million lines no longer blank the page, and you can scroll all the way to the bottom of them. Exports of any size download fine.',
      },
      {
        title: 'smaller fixes',
        body: 'Clicking a pattern shows only its own rows. Clicking a value in the airlock summary filters the table to its lines. Messages that mention a level word partway through keep all their text, and more log styles get the right level and time. CSV exports open safely in spreadsheets.',
      },
    ],
  },
  {
    id: '2026-10-v2',
    date: 'october 2026',
    title: 'logninja v2',
    items: [
      {
        title: 'log patterns',
        body: 'Flip the "rows / patterns" switch above the table and lines that only differ by numbers, ids, IPs or paths fold into one pattern, with a count, level mix and when it showed up. Sort by rarest to find the odd lines out, or by most errors. Click a pattern to see just its rows.',
      },
      {
        title: 'a new timeline',
        body: 'Bars are split by level, so bursts of errors stand out. Hover a bar for its counts, click it to zoom in, or drag across bars to zoom into a range. In find mode, your search hits show up under the bars.',
      },
      {
        title: 'airlock logs from every platform',
        body: 'Airlock 7.x debug logs from Windows, Linux and macOS agents now read properly, and the airlock summary fills in agent, host, policy and file check details for each. Click a value to jump to the lines behind it.',
      },
      {
        title: 'easier query builder',
        body: 'Hit "build query" and list the words a line should have (any or all of them) and the ones it shouldn\'t, with * as a wildcard and a live preview. Name a query to save it: it shows up under presets, and "edit query" reopens it.',
      },
      {
        title: 'a fresh look',
        body: 'A new monospace theme with five palettes (tokyo night, catppuccin, rosé pine, gruvbox and kanagawa), each in light or dark, or following your device. Pick one in settings.',
      },
      {
        title: 'smaller things',
        body: 'Times in the table are now your local time (hover one for the original). Rotated logs like server.log.1 load, and anything that isn\'t a log is skipped with a note. Bookmarks stay on their line when you add another file. A plain click turns a level filter on or off. The table fits the window, so only the rows scroll.',
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
