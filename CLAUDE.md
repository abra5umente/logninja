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

docker build -t logninja .                # Node 18 build stage -> nginx:alpine serving dist/
docker run --rm -p 8080:80 logninja
```

Unit tests use Vitest and sit next to the code they cover (`src/lib/parse.test.ts`, `src/lib/search.test.ts`); they cover pure logic in `src/lib/`, not React components. Run `npm test` and `npm run build` (strict `tsc`, which also type-checks the tests) after changes. There is no linter or formatter. The root `test*.js` files are empty placeholders. `.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run build` on every PR and push to `main`; `.github/workflows/claude.yml` only runs Claude when someone mentions `@claude`.

## Architecture

### State lives in App.tsx

`src/App.tsx` owns all application state (`entries`, `loadedFiles`, `filters: FiltersState`, `bookmarked: Set<number>`, theme, modals) and passes data and callbacks down. Components in `src/components/` are presentational; pure logic lives in `src/lib/`. There is no state library or router.

### Load pipeline

`FileDropZone` (window-wide drag-and-drop plus Browse button) decodes each file (UTF-8 / UTF-16 BOM detection) and calls `onText(text, name)` in App. `onText`:

1. Generates a `fileId`, assigns a color from `FILE_COLORS`.
2. If `isAirlockDebugFileName(name)` matches (`/airlock[\w.-]*\.log$/i`), runs `extractAirlockSummary` and opens the Airlock modal.
3. Calls `parseLog(text, fileId, name)` from `lib/parse.ts`.
4. Merges into existing entries, sorts by time (null timestamps last), and **re-indexes every entry** so `entry.index` is its position in the merged array.

All of this is done with nested functional `setState` updates because several files can be dropped at once; keep it that way to avoid stale closures.

### Parsing (`lib/parse.ts`)

`parseLog` is a single pass over lines (capped at 1,000,000). Each line first goes through `detectTimestamp`, which tries the leading-timestamp regexes in order (`reISO`, `reYMD_HMS`, `reYMD_SLASH_HMS`, `reDMY_HMS`, `reMDY_HMS`, `reDMON_HMS`, `reREDIS_PREFIX_DMON_HMS`); on a hit, `detectLevel` finds `ERROR|WARN|INFO|DEBUG|TRACE` (default `INFO`). If no timestamp matches, it falls back through Resque, MSI, Apache combined, Ruby Logger and MongoDB JSON branches; if none match, the line is appended to the previous timestamped entry as a continuation (or becomes its own row with no time if there is nothing timestamped to attach to). Two formats start with a plain timestamp and are claimed before `detectTimestamp`: Airlock agent `FILE CHECK` lines (level comes from `Result=`, never from scanning the line) and Go-logger lines (`file.go:123:`). The no-timestamp fallbacks also cover the Airlock server's bracketed-timestamp, `ServerActivityMessage|`, Passenger, `date`-style and resque `***` lines. A pre-scan finds a base date for time-only formats (MSI). To add a format: add a regex/branch in `parse.ts` (order matters, since the first match wins) and update README's "Supported Formats".

### Filtering and search

`FiltersState` (`lib/types.ts`) drives one big `filtered` `useMemo` in App. Filters combine: `selectedFiles`, `selectedLevels` (falls back to deprecated `selectedLevel`), `timeRange` (end-exclusive; entries without a timestamp are dropped while a time range is active), `showBookmarksOnly` + `bookmarkContext`, and the search query.

Search has three behaviours:
- `searchMode: 'find'` (the default): does **not** filter; App computes `matchingIndices` and Enter / Shift+Enter jumps between them via `currentMatchIndex`.
- `searchMode: 'filter'`: hides non-matching rows.
- `highlightOnly`: like find, shows everything and only highlights.

`buildSearchRegex` (`lib/search.ts`) escapes plain text or compiles user regex with flags `gi`, strips PCRE `(?i)`, rejects patterns over 1000 chars or containing `.*.*`, `++`, `**`, and returns `{ re: null }` on any failure. Matching runs against `` `${timeStr} ${level} ${message}` ``, not the raw line or `source`. `RegexBuilder` + `lib/regexBuilder.ts` is a visual segment-based builder that produces a pattern for the search bar.

When adding a filter field: add it to `FiltersState`, the initial state and the reset handler in App, the `filtered` memo (and `matchingIndices` if it should affect find mode), and the Markdown summary in `lib/export.ts` (`buildMarkdownSummary`, which currently only reads the deprecated `selectedLevel`).

### Virtual table

`VirtualTable.tsx` always virtualises: fixed row height 28px (no-wrap) or an estimated 48px (wrap, rows may grow), 12 rows overscan, highlighting disabled when more than 1000 rows are passed in. It needs a **numeric pixel `height` prop**. App measures the centre column and timeline with a `ResizeObserver` and passes `tableHeight` (min 400, fallback 600). Do not switch the table to CSS `flex: 1` / auto height: the scroll math depends on a known viewport height and earlier attempts caused effect loops and crashes on file load.

### Timeline

`TimelinePanel.tsx` bins the currently filtered entries with `groupByBinsMs` (`lib/time.ts`) at five levels: Day → Hour → 15 min → Minute → Second (`LEVEL_CONFIG`). It starts at Hour if the span is ≤24h, otherwise Day. Clicking a bin both sets `filters.timeRange` and drills down one level; a history stack powers "Back to …". Min/max are computed with loops, not `Math.min(...arr)`, to avoid stack overflows on large inputs; keep it that way.

### Other pieces

- `lib/airlockSummary.ts` extracts Airlock Digital agent metadata for the in-app modal. Fields and their order come from `AIRLOCK_FIELD_GROUPS`; the Linux 7.x fields are gathered in one pass by `collectAgentStats`, the older Windows/Linux fields by per-field scans in `extractAirlockSummary`. To add a field: add it to a group, return its value from `get`, and give it a search string in `getAirlockFieldSearchString` (any regex metacharacter makes the modal run it as a regex; it is matched against `time level message`). Tests in `airlockSummary.test.ts` use a made-up log; real logs stay in the gitignored `logs/`. `scripts/airlock-summary.mjs` is a separate, standalone Node copy of similar logic with its own field list and a stricter filename check (`airlock.<n>.log`); changes to one are not reflected in the other.
- `lib/theme.ts` persists `theme` (default dark, via Tailwind `class` strategy) and `accent` (default `#30F24E`, exposed as CSS var `--accent`) in localStorage. Nothing else is persisted.
- `CommandPalette` (Ctrl/Cmd+K) takes a `commands` list built in App. Typing `pizza` triggers the easter egg in `lib/pizzaTheme.ts` (`pizza-mode` body class, `src/assets/pizza.png`); `CreditsModal` credits the asset.
- Keyboard: `/` focuses search, Ctrl/Cmd+K palette, Ctrl/Cmd+C copies the selected row's raw line, Esc closes modals.

## Gotchas

- `entry.index` is reassigned on every file add/remove, but `bookmarked` stores indices and is not remapped on add (only pruned on remove). Bookmarks can point at different rows after loading another file. Anything else keyed by `index` has the same problem.
- The `package.json` name is still `log-slicer`; the product name is LogNinja.
