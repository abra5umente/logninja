# Repository Guidelines

## Project Structure & Modules
- `src/`: TypeScript React app. UI in `src/components/` (PascalCase), utilities in `src/lib/` (camelCase). Entry points: `src/main.tsx`, `src/App.tsx`.
- `public/`: Static assets (e.g., `sample.log`) served at root.
- `scripts/`: Maintenance/CLI utilities (e.g., `airlock-summary.mjs`).
- Root: `index.html`, Tailwind config, Vite config, TypeScript configs.

## Build, Test, and Development
- `npm run dev`: Start Vite dev server with HMR (binds `0.0.0.0`).
- `npm run build`: Type-check (`tsc -b`) and produce production build.
- `npm run preview`: Serve the built app locally for QA (`0.0.0.0`).
- `npm run airlock-summary -- path/to/airlock.log`: Print two‑column summary for Airlock debug logs.
- Requirements: Node.js 18+ and npm.

## Airlock Logs & Summary
- Drag/drop or browse `.log/.txt/.csv`. UTF‑8/UTF‑16 supported (BOM-aware).
- Airlock detection: filenames like `airlock.log`, `airlock.0.log`, `airlock-debug-*.log` trigger the summary. Windows and Linux agent logs are supported.
- Timestamp formats parsed: `YYYY-MM-DD HH:mm:ss[,SSS]`, `YYYY-MM-DDTHH:mm:ss[.SSS][Z|±hh:mm]`, and `dd/MM/yyyy HH:mm:ss[.SSS][ AM|PM]` (MDY inferred when ambiguous).
- Summary fields extracted (OS-aware where applicable):
  - Airlock Version; Proxy Configured; Primary Airlock Server
  - Interops Found; Policy DB Loaded; Policy DB Version; Audit Mode; AutoUpdate Enabled
  - Powershell Constrained Mode; File Extensions Added; Publishers Loaded; Path Exclusions
  - Assembly Reflection Enabled; Self Service Enabled
  - Blocklist Metarules loaded (unique metarule names; Windows: “Loading Blocklist Metarule: …”, Linux: “Loading metarules … Metarule: …”)
  - Allowlist Metarules loaded (unique metarule names; Windows: “Loading Allowlist Metarule: …”, Linux: “Loading ametarules … Metarule: …”)
  - Allowlist Browser Extensions loaded
  - Parent Processes (unique paths; Windows: “Loading Parent Process: …”, Linux: “Loading Process Exclusion (pprocesses): …”)
  - Execution Count and Top Executed File (Windows: “Responding to Kernel … SUCCESS”; Linux: timestamped “FILE CHECK Filename=…”) 
- Clicking values applies an OS-aware filter to the table and auto-enables regex where needed. Linux filters use non-anchored tokens for cell-level highlight.

## Coding Style & Naming
- TypeScript strict mode enabled; prefer typed props and return types.
- Components: PascalCase files in `src/components/` (e.g., `TimelinePanel.tsx`).
- Modules/utilities: camelCase in `src/lib/` (e.g., `parse.ts`, `airlockSummary.ts`).
- Constants: UPPER_SNAKE_CASE; functions/vars: camelCase.
- Indentation: 2 spaces. Styling via Tailwind classes in JSX.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Place tests alongside source or under `src/__tests__/` using `*.test.ts(x)` naming.
- Aim for fast unit tests around `src/lib/*` (e.g., parsing, search) and lightweight component tests for critical flows.

## Troubleshooting
- Empty table after load: confirm timestamps in the first lines match supported patterns.
- Summary shows dashes: ensure filename matches Airlock pattern and the log contains expected markers. For Linux, execution lines must include timestamped `FILE CHECK Filename=`.
- Try the included `startup.log` in the project root to compare behavior.

## UX Notes (Implementation)
- Horizontal scroll for long lines; toggle “Wrap” in header.
- Timeline supports 1s/5s/15s/30s and minute bins (ms-based in `groupByBinsMs`).
- Bookmark lines via the star; exports add a “Bookmarked Lines” section.
- Click a row then press Ctrl/Cmd+C to copy its raw line.

## Commit & Pull Requests
- Commits: Use imperative, concise messages (e.g., "Add virtual table filtering"). Group related changes.
- PRs must include: clear description, before/after screenshots for UI changes, steps to validate locally, and linked issues.
- Keep PRs focused; include small, reviewable diffs and relevant `scripts/` updates when adding tooling.
- Use git commit -m before making any code changes with a descriptive commit message.

## Security & Configuration Tips
- This app runs fully client‑side; avoid committing sensitive logs. Use `public/sample.log` for examples.
- Large files: prefer links or sanitized snippets. Validate regex features when sharing filters.

## Theming & Accent
- Dark mode: Tailwind `dark` class toggled on `html` via helpers in `src/lib/theme.ts` (`applyTheme`, `getInitialTheme`, persisted in `localStorage`).
- Accent color: global CSS var `--accent` defined in `src/index.css`; update via `applyAccent`/`getInitialAccent` (persisted). Components use accent for focus rings, borders, links, and selected states.
- Settings sidebar: `src/components/SettingsSidebar.tsx` includes light/dark toggle, accent picker, keymap, and footer with version and GitHub link. Open via the gear in the header.

## Branding
- Vertical banner: `src/components/BrandingBanner.tsx` renders a fixed, rotated “logninja.” watermark along the left gutter. It sits behind the app (`-z-10`) and is clipped to a narrow gutter to avoid overlaying content. Includes a first‑load typing effect (respects reduced motion).
- Header: the large app title is removed from the top bar; branding appears in the Settings sidebar footer as `LogNinja v0.1.0-beta` next to the GitHub link.

## Pizza Easter Egg
- Trigger: open Command Palette (Ctrl/Cmd+K) and type `pizza`.
- Effect: body gets `pizza-mode` which draws a subtle tiled pizza overlay via `body.pizza-mode::before` in `src/index.css`.
  - Light mode opacity ~0.18; Dark mode opacity ~0.20.
- Asset: `src/assets/pizza.png`. URL is resolved at runtime using `new URL('../assets/pizza.png', import.meta.url)` inside `enablePizzaTheme()`.

## Containerization
- Dockerfile: multi‑stage build (Node 18 Alpine → Nginx). Builds with `npm ci && npm run build`, serves `dist/` via Nginx.
- Nginx: SPA fallback config in `nginx.conf`; assets served with long cache headers.
- Quickstart:
  - Build: `docker build -t logninja .`
  - Run: `docker run --rm -p 8080:80 logninja` then visit `http://localhost:8080`.

## UI Notes (Recent)
- Export modal: themed for readability; buttons use accent focus ring; textarea colors match theme.
- Timeline: bars use accent color with opacity; filters and selects use accent focus rings.
- Virtual table: Wrap toggle uses accent focus ring; selected row shows accent left border; header layout flexes so the Wrap button stays aligned when resizing.
