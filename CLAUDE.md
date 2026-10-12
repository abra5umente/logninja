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

Unit tests use Vitest and sit next to the code they cover (e.g. `src/lib/parse.test.ts`, `src/lib/regexBuilder.test.ts`); they cover pure logic in `src/lib/`, not React components. Run `npm test` and `npm run build` (strict `tsc`, which also type-checks the tests) after changes. There is no linter or formatter. The root `test*.js` files are empty placeholders. `.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run build` (Node 24) on every PR and on pushes to `main` and `v*` tags; on those pushes only, its `image` job then builds the Dockerfile and publishes `ghcr.io/abra5umente/logninja` as `:main` + `:sha-<commit>` (or `:1.2.3` + `:1.2` for a `v1.2.3` tag), same as abraboard. PRs don't build or publish an image; `.github/workflows/claude.yml` only runs Claude when someone mentions `@claude`.

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

`parseLog` is a single pass over lines (capped at 1,000,000). Each line first goes through `detectTimestamp`, which tries the leading-timestamp regexes in order (`reISO`, `reYMD_HMS`, `reYMD_SLASH_HMS`, `reDMY_HMS`, `reMDY_HMS`, `reDMON_HMS`, `reREDIS_PREFIX_DMON_HMS`); on a hit, `detectLevel` finds `ERROR|WARN|INFO|DEBUG|TRACE` (default `INFO`). If no timestamp matches, it falls back through Resque, MSI, Apache combined, Ruby Logger and MongoDB JSON branches; if none match, the line is appended to the previous timestamped entry as a continuation (or becomes its own row with no time if there is nothing timestamped to attach to). A few formats start with a plain timestamp and are claimed before `detectTimestamp`: Airlock Linux and macOS agent `FILE CHECK` lines (level comes from `Result=`, never from scanning the line), the two macOS-only forms (`INFO  FILE CHECK Filename: <path>, OpType: N, Result: ...` for Apple's own binaries, and `INFO  ERROR: ...`, which becomes an ERROR row), Airlock Windows agent lines (tab-separated time, kind, thread id, message; `FILE CHECK` and `[EXT-BLOCK] Extension Title:` lines take their level from `Result:`, and the thread id is kept in the message as `[1234]`) and Go-logger lines (`file.go:123:`). Slash dates (`10/12/2026`) are read in one order for the whole file: a pre-scan looks for a value above 12, and when there is none the Windows agent's lines are read month first and everything else day first. The no-timestamp fallbacks also cover the Airlock server's bracketed-timestamp, `ServerActivityMessage|`, Passenger, `date`-style and resque `***` lines. A pre-scan finds a base date for time-only formats (MSI). To add a format: add a regex/branch in `parse.ts` (order matters, since the first match wins) and update README's "Supported Formats".

### Filtering and search

`FiltersState` (`lib/types.ts`) drives one big `filtered` `useMemo` in App. Filters combine: `selectedFiles`, `selectedLevels` (falls back to deprecated `selectedLevel`), `timeRange` (end-exclusive; entries without a timestamp are dropped while a time range is active), `showBookmarksOnly` + `bookmarkContext`, and the search query.

Search has three behaviours:
- `searchMode: 'find'` (the default): does **not** filter; App computes `matchingIndices` and Enter / Shift+Enter jumps between them via `currentMatchIndex`.
- `searchMode: 'filter'`: hides non-matching rows.
- `highlightOnly`: like find, shows everything and only highlights.

`buildSearchRegex` (`lib/search.ts`) escapes plain text or compiles user regex with flags `gi`, strips PCRE `(?i)`, rejects patterns over 1000 chars or containing `.*.*`, `++`, `**`, and returns `{ re: null }` on any failure. Matching runs against `` `${timeStr} ${level} ${message}` ``, not the raw line or `source`. `RegexBuilder` + `lib/regexBuilder.ts` is the query builder: a `BuilderQuery` is `include` terms (match `any` or `all`) plus `exclude` terms, each `text` (escaped, `*` becomes `.*?`) or `regex`. `buildPattern` matches the wanted terms themselves (so they highlight) and puts the all-of / none-of checks in a lookbehind anchored at `^`: `(?:a|b)(?<=^(?=[\s\S]*?a)(?=[\s\S]*?b)(?![\s\S]*?x)[\s\S]*)`. Highlighting runs per cell, so an all-of term in another column (e.g. the level) can leave a matched row unhighlighted. `SearchBar` remembers the last built query and reopens it (or a saved query with the same regex, or one seeded from the search box by `queryFromSearch`) when "edit query" / "build query" is clicked. Saved queries live in `lib/savedQueries.ts` (localStorage key `logninja.savedQueries`, a small store with `useSavedQueries`) and appear in `PresetsDropdown`.

When adding a filter field: add it to `FiltersState`, the initial state and the reset handler in App, the `filtered` memo (and `matchingIndices` if it should affect find mode), and the Markdown summary in `lib/export.ts` (`buildMarkdownSummary`, which currently only reads the deprecated `selectedLevel`).

### Styling

`src/theme.css` is the shared house theme (palettes, JetBrains Mono, glass panels, `.btn`, `.in`, `.seg`, `.pill`, `.stat`, `.bar` meters, `.empty` / `.error` with kaomoji). It is a copy: don't hand-edit it, re-copy it from the original when the house style changes. `main.tsx` loads Tailwind's reset (`tailwind-base.css`), then `theme.css`, then `index.css` (LogNinja's own classes plus Tailwind utilities); keep that order. `tailwind.config.cjs` replaces Tailwind's colour palette with the theme's ten named colours (`bg`, `surface`, `fg`, `muted`, `accent`, `green`, `yellow`, `red`, `magenta`, `cyan`, plus `line` / `line-strong`), so `gray-700`-style classes no longer exist; `bg-accent/15` works and becomes a `color-mix` tint. House rules: monospace everywhere, lowercase headings (tiny uppercase `.lbl` labels are the exception), green / yellow / red only for ok / warning / error, no shadows or gradients on panels, kaomoji in empty, loading and error states, two clicks for destructive actions (removing a file). Log level colours live in `lib/levelColors.ts`, ASCII meters in `lib/meter.ts`. `.glass` panels use `backdrop-filter`, which traps `position: fixed` children, so modals opened from inside a panel render through `components/Modal.tsx` (a portal to `<body>`). The font comes from Google Fonts; offline it falls back to the system monospace.

### Virtual table

`VirtualTable.tsx` always virtualises: fixed row height 28px (no-wrap) or an estimated 48px (wrap, rows may grow), 12 rows overscan, highlighting disabled when more than 1000 rows are passed in. It needs a **numeric pixel `height` prop**. App measures the centre column and timeline with a `ResizeObserver` and passes `tableHeight` (min 400, fallback 600). Do not switch the table to CSS `flex: 1` / auto height: the scroll math depends on a known viewport height and earlier attempts caused effect loops and crashes on file load.

### Timeline

`TimelinePanel.tsx` bins the currently filtered entries with `groupByBinsMs` (`lib/time.ts`) at five levels: Day → Hour → 15 min → Minute → Second (`LEVEL_CONFIG`). It starts at Hour if the span is ≤24h, otherwise Day. Clicking a bin both sets `filters.timeRange` and drills down one level; a history stack powers "Back to …". Min/max are computed with loops, not `Math.min(...arr)`, to avoid stack overflows on large inputs; keep it that way.

### Other pieces

- `lib/airlockSummary.ts` extracts Airlock Digital agent metadata for the in-app modal. Fields and their order come from `AIRLOCK_FIELD_GROUPS`; the 7.x fields are gathered in one pass by `collectAgentStats` (Linux and macOS, whose lines are nearly the same; the pass switches `platform` to `macos` when it sees a line only macOS writes) or `collectWindowsAgentStats` (Windows), which fill the same shape from `newAgentStats`; the older Windows/Linux fields come from per-field scans in `extractAirlockSummary`. Searches that differ for Windows rows live in `windowsFieldSearchString`, and for macOS rows in `macFieldSearchString`. To add a field: add it to a group, return its value from `get`, and give it a search string in `getAirlockFieldSearchString` (any regex metacharacter makes the modal run it as a regex; it is matched against `time level message`). Tests in `airlockSummary.test.ts` use a made-up log; real logs stay in the gitignored `logs/`. `scripts/airlock-summary.mjs` is a separate, standalone Node copy of similar logic with its own field list and a stricter filename check (`airlock.<n>.log`); changes to one are not reflected in the other.
- `lib/theme.ts` persists `palette` (`tokyo` default, `catppuccin`, `rosepine`, `gruvbox`, `kanagawa`) and `theme` (`system` default, `light`, `dark`) in localStorage and sets them on `<html>` as `data-theme` / `data-scheme`. An inline script in `index.html` does the same before first paint, so keep the two in step. The only other thing persisted is saved queries (`lib/savedQueries.ts`).
- `CommandPalette` (Ctrl/Cmd+K) takes a `commands` list built in App. Typing `pizza` triggers the easter egg in `lib/pizzaTheme.ts` (`pizza-mode` body class, `src/assets/pizza.png`); `CreditsModal` credits the asset.
- Keyboard: `/` focuses search, Ctrl/Cmd+K palette, Ctrl/Cmd+C copies the selected row's raw line, Esc closes modals.

## Gotchas

- `entry.index` is reassigned on every file add/remove, but `bookmarked` stores indices and is not remapped on add (only pruned on remove). Bookmarks can point at different rows after loading another file. Anything else keyed by `index` has the same problem.
- The `package.json` name is still `log-slicer`; the product name is LogNinja.
