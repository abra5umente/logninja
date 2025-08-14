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
