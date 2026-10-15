# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LogNinja** is a client-side log viewer (Vite 5 + React 18 + TypeScript 5 + Tailwind 3). All parsing, filtering and exporting happens in the browser; nothing is uploaded. The only runtime dependencies are `react` and `react-dom`. User-facing features are documented in README.md.

## Commands

```bash
npm install
npm run dev              # Vite dev server on 0.0.0.0:5173 (LAN reachable)
npm run build            # tsc -b && vite build -> dist/
npm run preview          # serve dist/ on 0.0.0.0
npm test                 # run Vitest once (unit tests in src/**/*.test.ts)
npm run test:watch       # Vitest in watch mode
npm run airlock-summary -- path/to/airlock.0.log   # CLI: print Airlock metadata table to stdout

docker build -t logninja .                # Node 24 build stage -> nginx:alpine serving dist/
docker run --rm -p 8080:80 logninja
```

Unit tests use Vitest and sit next to the code they cover (e.g. `src/lib/parse.test.ts`, `src/lib/regexBuilder.test.ts`); they cover pure logic in `src/lib/`, not React components. Run `npm test` and `npm run build` (strict `tsc`, which also type-checks the tests) after changes. There is no linter or formatter. The root `test*.js` files are empty placeholders. `.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run build` (Node 24) on every PR and on pushes to `main`; on those pushes only, its `image` job then builds the Dockerfile and publishes `ghcr.io/abra5umente/logninja` as `:main` + `:sha-<commit>`. There are no version tags or version numbers: `:main` is the only release, and the settings footer just says "logninja on github". PRs don't build or publish an image; `.github/workflows/claude.yml` only runs Claude when someone mentions `@claude`.

## Architecture

### State lives in App.tsx

`src/App.tsx` owns all application state (`entries`, `loadedFiles`, `filters: FiltersState`, `bookmarked: Set<number>`, theme, modals) and passes data and callbacks down. Components in `src/components/` are presentational; pure logic lives in `src/lib/`. There is no state library or router.

### Load pipeline

App's window-wide drop handler and the hidden Browse input both go through `loadFiles`, which takes any file name (rotated logs like `server.log.1`, `syslog`) and reads each with `readLogFile` (`lib/decode.ts`: UTF-8 / UTF-16 BOM detection plus BOM-less UTF-16, then `looksLikeText` rejects archives and other binary files, which are listed in a `SkippedNotice`; don't go back to `file.text()`, which garbles UTF-16). Each text file goes to `onText(text, name)`. `onText`:

1. Generates a `fileId` and calls `parseLog(text, fileId, name)` from `lib/parse.ts` (outside any state updater, so it runs once and the load time is real).
2. If `isAirlockDebugFileName(name)` matches (`/airlock[\w.-]*\.log$/i`), runs `extractAirlockSummary`, remembers the file as `airlockFileId` and opens the Airlock modal.
3. Adds the file with the first `FILE_COLORS` colour not already in use.
4. Merges into existing entries, sorts by time (null timestamps last), and **re-indexes every entry** so `entry.index` is its position in the merged array.

State changes use functional `setState` updates because several files can be dropped before React re-renders; keep it that way to avoid stale closures. `removeFile` drops the file's entries and bookmarks, takes it out of `selectedFiles`, clears the Airlock summary if it came from that file, and resets every filter when the last file goes.

### Parsing (`lib/parse.ts`)

`parseLog` is a single pass over lines (capped at 1,000,000). Each line first goes through `detectTimestamp`, which tries the leading-timestamp regexes in order (`reISO`, `reYMD_HMS`, `reYMD_SLASH_HMS`, `reDMY_HMS`, `reMDY_HMS`, `reDMON_HMS`, `reREDIS_PREFIX_DMON_HMS`); on a hit, `detectLevel` finds `ERROR|WARN|INFO|DEBUG|TRACE` (default `INFO`). If no timestamp matches, it falls back through Resque, MSI, Apache combined, Ruby Logger and MongoDB JSON branches; if none match, the line is appended to the previous timestamped entry as a continuation (or becomes its own row with no time if there is nothing timestamped to attach to). A few formats start with a plain timestamp and are claimed before `detectTimestamp`: Airlock Linux and macOS agent `FILE CHECK` lines (level comes from `Result=`, never from scanning the line), the two macOS-only forms (`INFO  FILE CHECK Filename: <path>, OpType: N, Result: ...` for Apple's own binaries, and `INFO  ERROR: ...`, which becomes an ERROR row), Airlock Windows agent lines (tab-separated time, kind, thread id, message; `FILE CHECK` and `[EXT-BLOCK] Extension Title:` lines take their level from `Result:`, and the thread id is kept in the message as `[1234]`) and Go-logger lines (`file.go:123:`). Slash dates (`10/12/2026`) are read in one order for the whole file: a pre-scan looks for a value above 12, and when there is none the Windows agent's lines are read month first and everything else day first. The no-timestamp fallbacks also cover the Airlock server's bracketed-timestamp, `ServerActivityMessage|`, Passenger, `date`-style and resque `***` lines. A pre-scan finds a base date for time-only formats (MSI). To add a format: add a regex/branch in `parse.ts` (order matters, since the first match wins) and update README's "Supported Formats".

### Filtering and search

`FiltersState` (`lib/types.ts`) drives the `baseFiltered` and `filtered` memos in App. `passesBaseFilters` (`lib/filter.ts`) applies `selectedFiles`, `selectedLevels` (falls back to deprecated `selectedLevel`) and `timeRange` (end-exclusive; entries without a timestamp are dropped while a time range is active). On top of that, `showBookmarksOnly` shows bookmarks plus `bookmarkContext` rows either side, taken from the base-filtered rows (`withBookmarkContext`), and otherwise the search query applies per mode.

Search has three behaviours:
- `searchMode: 'find'` (the default): does **not** filter; App computes `matchingKeys` (entry keys) and Enter / Shift+Enter jumps between them via `currentMatchIndex`.
- `searchMode: 'filter'`: hides non-matching rows.
- `highlightOnly`: like find, shows everything and only highlights.

Search within results: `filters.searchSteps` (`SearchStep`: `query`, `useRegex`, `exclude`) are earlier searches the user pinned with "search within these" / "hide these" (or Ctrl/Cmd+Enter, with Shift to exclude), which empties the search box. App applies them right after `passesBaseFilters` via `applySearchSteps` (`lib/search.ts`, one step at a time so the trail in `SearchBar` can show each step's count), so `baseFiltered` is already narrowed and find, filter, bookmarks and patterns work within it; `timelineEntries` uses the combined `buildStepsMatcher`. `buildMatcher` is the one search test, shared by the search box and the steps. Only the search box's query is highlighted.

`buildSearchRegex` (`lib/search.ts`) escapes plain text or compiles user regex with flags `gi`, strips PCRE `(?i)`, rejects patterns over 1000 chars or containing `.*.*`, `++`, `**`, and returns `{ re: null }` on any failure. Matching runs against `` `${timeStr} ${level} ${message}` ``, not the raw line or `source`; when the query has a digit, `buildMatcher` also tries the time as the table shows it (`shownSearchText`), so a time the user can see is found. The table shows times via `formatEntryTime` (`lib/formatTime.ts`), matching the timeline, and highlighting runs on that displayed text.

Time display (`lib/timeMode.ts`, localStorage key `logninja.timeMode`): `local` (default) shows the viewer's zone, `log` shows each zoned timestamp (`Z`, `+10:00`, `+1000`) on the clock it was written in. App does this once, as `shownEntries = inLogTime(entries)`, moving `time` so local getters read the log's clock; everything downstream (filters, time range, timeline, summary, patterns, CSV and Markdown exports) uses `shownEntries` and needs no mode of its own. Switching clears the time range. Sorting still uses the real times in `entries`. The toggle sits in the table header and the command palette. `RegexBuilder` + `lib/regexBuilder.ts` is the query builder: a `BuilderQuery` is `include` terms (match `any` or `all`) plus `exclude` terms, each `text` (escaped, `*` becomes `.*?`) or `regex`. `buildPattern` matches the wanted terms themselves (so they highlight) and puts the all-of / none-of checks in a lookbehind anchored at `^`: `(?:a|b)(?<=^(?=[\s\S]*?a)(?=[\s\S]*?b)(?![\s\S]*?x)[\s\S]*)`. Highlighting runs per cell, so an all-of term in another column (e.g. the level) can leave a matched row unhighlighted. `SearchBar` remembers the last built query and reopens it (or a saved query with the same regex, or one seeded from the search box by `queryFromSearch`) when "edit query" / "build query" is clicked. Saved queries live in `lib/savedQueries.ts` (localStorage key `logninja.savedQueries`, a small store with `useSavedQueries`) and appear in `PresetsDropdown`.

Exports are built on click, never during render: `ExportBar` used to build the whole CSV in a `useMemo`, and past about a million long rows that string is longer than Chrome allows (about 512 MB), which threw and blanked the page. Downloads go through `csvBlob`, a Blob made from `rowsToCSVChunks` pieces, so they have no size limit; copying needs one string and says "too big to copy" when it can't. CSV times are written as the table shows them, with the header saying which clock (`Time (local)` / `Time (as logged)`), and cells starting `=`, `+`, `-`, `@` get a leading `'` so spreadsheets don't run them as formulas.

When adding a filter field: add it to `FiltersState`, the initial state and the reset handler in App, `passesBaseFilters` (which feeds `filtered`, `matchingKeys` and the bookmark view) or the `filtered` memo, and the Markdown summary in `lib/export.ts` (`buildMarkdownSummary`).

### Styling

`src/theme.css` is the shared house theme (palettes, JetBrains Mono, glass panels, `.btn`, `.in`, `.seg`, `.pill`, `.stat`, `.bar` meters, `.empty` / `.error` with kaomoji). It is a copy: don't hand-edit it, re-copy it from the original when the house style changes. `main.tsx` loads Tailwind's reset (`tailwind-base.css`), then `theme.css`, then `index.css` (LogNinja's own classes plus Tailwind utilities); keep that order. `tailwind.config.cjs` replaces Tailwind's colour palette with the theme's ten named colours (`bg`, `surface`, `fg`, `muted`, `accent`, `green`, `yellow`, `red`, `magenta`, `cyan`, plus `line` / `line-strong`), so `gray-700`-style classes no longer exist; `bg-accent/15` works and becomes a `color-mix` tint. House rules: monospace everywhere, lowercase headings (tiny uppercase `.lbl` labels are the exception), green / yellow / red only for ok / warning / error, no shadows or gradients on panels, kaomoji in empty, loading and error states, two clicks for destructive actions (removing a file). Log level colours live in `lib/levelColors.ts`, ASCII meters in `lib/meter.ts`. `.glass` panels use `backdrop-filter`, which traps `position: fixed` children, so modals opened from inside a panel render through `components/Modal.tsx` (a portal to `<body>`). The font comes from Google Fonts; offline it falls back to the system monospace.

### Virtual table

`VirtualTable.tsx` always virtualises: fixed row height 28px (no-wrap); in wrap mode rows start at a 48px guess and each rendered row is measured (a `ResizeObserver` plus a re-read after every render, since a reused row that moved doesn't resize) into a per-position height array that feeds row offsets, and jumping to the selected row re-centres as measurements arrive until it settles or the user scrolls. 12 rows overscan, highlighting disabled when more than 1000 rows are passed in. Browsers cap an element's height (about 33.5 million px in Chrome, so about 1.2 million 28px rows), so when the rows are taller than that `lib/scrollMap.ts` scales the scroll range: the spacer is as tall as the browser allows (measured once) and a scroll position stands for a proportional position in the rows. It needs a **numeric pixel `height` prop**, the height of the whole panel (header plus rows). App measures the table's wrapper in the centre column (`flex-1 min-h-0`, so its size comes from the viewport and the timeline, never from the table's content) with a `ResizeObserver` and passes it as `tableHeight` (min 160, fallback 600). Inside, the header keeps its natural height and the rows container fills the rest; it is the only scroller, in both directions, and the column labels follow its horizontal scroll via a transform. Don't make the panel's own height auto: the scroll math depends on a known viewport height and earlier attempts caused effect loops and crashes on file load.

### Timeline

`TimelinePanel.tsx` gets `timelineEntries` from App: rows after the file, level and (filter-mode) search filters but **not** the time range, so picking a range doesn't empty the bars around it. In find / highlight mode App also passes `isMatch`, and hits per bar show as a strip under the chart. The panel keeps a `view` range (null = the full extent) plus a history stack for "zoom out"; `pickBinMs` (`lib/time.ts`) picks the bar width from `BIN_STEPS` so a view has at most 72 bars, and `buildBins` aligns bars to the local clock (local midnight for day bars) and counts per level and matches. Clicking a bar or dragging across several sets `filters.timeRange` and zooms the view to it; at 1-second bars a click only filters. When the time range is cleared from elsewhere, the panel resets its view. Bars stack by level (ERROR at the bottom); axis labels are thinned by the measured chart width. `timeExtent` uses a loop, not `Math.min(...arr)`, to avoid stack overflows on large inputs; keep it that way.

### Patterns

The centre column switches between the table and `PatternsPanel.tsx` (App's `centerView`, the `ViewSwitch` in either header, or the command palette). Both render in the same measured wrapper with the same `tableHeight`. `lib/patterns.ts`: `templateOf` masks the first line of a message with one combined regex (`VARIABLE_RE`, alternatives in priority order as numbered groups, matched by `maskVariable`'s arguments; keep the two in step, and keep specific shapes before the bare number). Don't mask `key=value` values wholesale: Airlock's `Result=` must keep patterns apart. `groupRows` fills a `PatternGroups` a slice at a time (the panel groups up to 50k rows at once, otherwise 25k per tick with a progress meter), `rankPatterns` sorts and builds sparklines for the top patterns. Clicking a pattern puts `templateToRegex` in the search box in filter mode; that regex is looser than the mask and must stay under `buildSearchRegex`'s limits (1000 chars, no `.*.*`, `++`, `**`). Patterns are computed from `filtered`, so every other filter, including the timeline range, applies.

### Other pieces

- `lib/airlockSummary.ts` extracts Airlock Digital agent metadata for the in-app modal. Fields and their order come from `AIRLOCK_FIELD_GROUPS`; the 7.x fields are gathered in one pass by `collectAgentStats` (Linux and macOS, whose lines are nearly the same; the pass switches `platform` to `macos` when it sees a line only macOS writes) or `collectWindowsAgentStats` (Windows), which fill the same shape from `newAgentStats`; the older Windows/Linux fields come from per-field scans in `extractAirlockSummary`. Searches that differ for Windows rows live in `windowsFieldSearchString`, and for macOS rows in `macFieldSearchString`. To add a field: add it to a group, return its value from `get`, and give it a search string in `getAirlockFieldSearchString` (any regex metacharacter makes the modal run it as a regex; it is matched against `time level message`). Tests in `airlockSummary.test.ts` use a made-up log; real logs stay in the gitignored `logs/`. `scripts/airlock-summary.mjs` is a separate, standalone Node copy of similar logic with its own field list and a stricter filename check (`airlock.<n>.log`); changes to one are not reflected in the other.
- `lib/theme.ts` persists `palette` (`tokyo` default, `catppuccin`, `rosepine`, `gruvbox`, `kanagawa`) and `theme` (`system` default, `light`, `dark`) in localStorage and sets them on `<html>` as `data-theme` / `data-scheme`. An inline script in `index.html` does the same before first paint, so keep the two in step. The only other things persisted are the time display (`lib/timeMode.ts`), saved queries (`lib/savedQueries.ts`) and the id of the last "what's new" release seen (`lib/whatsNew.ts`, key `logninja.whatsNewSeen`).
- `WhatsNewModal` shows the newest entry in `WHATS_NEW` (`lib/whatsNew.ts`) once per browser, marking it seen as soon as it opens; settings ("what's new") and the command palette reopen it. To announce a release, add an entry with a new `id` at the top of the list; there are no version numbers, so the id is just a date-ish label.
- `CommandPalette` (Ctrl/Cmd+K) takes a `commands` list built in App. Typing `pizza` triggers the easter egg in `lib/pizzaTheme.ts` (`pizza-mode` body class, `src/assets/pizza.png`); `CreditsModal` credits the asset.
- Keyboard: `/` focuses search, Ctrl/Cmd+K palette, Ctrl/Cmd+C copies the selected row's raw line, Esc closes modals.

## Gotchas

- `entry.index` is reassigned on every file add/remove, so never use it to remember a row. Use `entryKey(entry)` (`lib/types.ts`: file id plus `entry.line`, the 1-based line in its own file where the entry starts), as `bookmarked` does. The selected row (`selectedKey`) and find matches are keyed the same way. The table's line column shows `entry.line`.
- The `package.json` name is still `log-slicer`; the product name is LogNinja.
