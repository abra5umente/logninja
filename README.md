# Log Slicer

A fast, client‑side log viewer built with Vite + React + TypeScript. Drag and drop logs, filter by level/text/regex, browse a timeline, and export results. Designed to work entirely in the browser (no uploads).

## Features
- Drag & drop `.log/.txt/.csv` (UTF‑8/UTF‑16 BOM aware)
- Search: plain text or regex, with match highlighting
- Level filters and time range filtering via timeline
- Timeline bins: 1s, 5s, 15s, 30s, 1/5/15 minutes
- Horizontal scroll + Wrap toggle for long lines
- Row selection + Ctrl/Cmd+C to copy the full raw line
- Bookmarks: star lines and export them (CSV/Markdown includes “Bookmarked Lines”)
- Airlock summary (auto when filename includes `airlock`; Windows + Linux agents):
  - Core: Version, Proxy Configured, Primary Airlock Server, Interops Found
  - Policy: Policy DB Loaded (Windows: “Opening Policy database”; Linux: “Init Policy: …”), Policy DB Version (prefers “Policy Update … current version is N” on Linux)
  - Modes/Config: Audit Mode, AutoUpdate Enabled, Powershell Constrained Mode
  - Data loads: File Extensions Added, Publishers Loaded, Path Exclusions, Assembly Reflection Enabled, Self Service Enabled
  - Metarules (deduped by name):
    - Blocklist Metarules loaded (Windows: “Loading Blocklist Metarule: …”; Linux: “Loading metarules … Metarule: …”)
    - Allowlist Metarules loaded (Windows: “Loading Allowlist Metarule: …”; Linux: “Loading ametarules … Metarule: …”)
  - Parent Processes (deduped): Windows “Loading Parent Process: …”; Linux “Loading Process Exclusion (pprocesses): …”
  - Executions:
    - Windows: count by “Responding to Kernel ~ Filename: … ~ SUCCESS”
    - Linux: count by timestamped “FILE CHECK Filename=…”. Top Executed File computed from same source
  - Click any value to filter main table; OS-aware tokens and auto-regex toggle applied

## Supported Formats (non‑exhaustive)
- ISO/RFC3339, `YYYY-MM-DD HH:mm:ss[.SSS|,SSS]`
- `YYYY/MM/DD HH:mm:ss[.SSS|,SSS]`
- DMY/MDY `dd/MM/yyyy HH:mm:ss[.SSS][ AM|PM]` (inferred)
- `dd Mon yyyy HH:mm:ss[.SSS]`
- Apache/Nginx combined: `dd/Mon/yyyy:HH:mm:ss Z`
- Redis: `PID:Role dd Mon yyyy HH:mm:ss.mmm <level-symbol> ...`
- Resque: `name: [LEVEL] <ISO ts>: message`
- Ruby logger lines: `W, [ISO ts #pid] WARN -- : message`
- MongoDB structured JSON `{ "t": { "$date": ... }, "s": "I", "msg": ... }`
- MSI: `MSI (c|s) (...) [HH:mm:ss:SSS]` (time‑only; date inferred from file), or `[YYYY-MM-DD HH:mm:ss:SSS]`

## Getting Started
- Requirements: Node.js 18+ and npm
- Install: `npm install`
- Dev: `npm run dev` (binds `0.0.0.0`), then visit `http://<your-ip>:5173`
- Build: `npm run build`
- Preview: `npm run preview` (binds `0.0.0.0`) at `http://<your-ip>:4173`

## Keyboard & Tips
- `/` focuses search, `Ctrl/Cmd+K` opens command palette
- Click a row, then `Ctrl/Cmd+C` to copy its full raw text
- Use the Wrap toggle for multi‑line viewing; disable for horizontal scrolling

## Privacy
The app runs fully in your browser; logs are not uploaded. Exports are generated locally.
 
## Notes on Airlock Linux vs Windows
- Linux agent events differ from Windows; the app accounts for this:
  - Executions are read from `FILE CHECK Filename=` lines (not Windows SUCCESS lines)
  - Policy DB cues prefer `Init Policy:` (loaded) and `Policy Update … current version is N`
  - Metarule counts use unique names to avoid duplicates
- Filters are OS-aware and highlight matches in the message column.
