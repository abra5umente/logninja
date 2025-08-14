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

**Local Install**
- Requirements: Node.js 18+ and npm
- Install: `npm install`
- Dev: `npm run dev` (binds `0.0.0.0`), then visit `http://localhost:5173` or `http://yourip:5173` from network devices
- Build: `npm run build`

**Docker (recommended)**
- Clone repo
- Build the image: `docker build -t logninja .`
- Run the container: `docker run --rm -p 8080:80 logninja`
- Open http://localhost:8080

Alternatively, run the container using `docker run --rm -p 8080:80 alexschladetsch/logninja:latest`
 
## Keyboard & Tips
- `/` focuses search, `Ctrl/Cmd+K` opens command palette
- Click a row, then `Ctrl/Cmd+C` to copy its full raw text
- Use the Wrap toggle for multi‑line viewing; disable for horizontal scrolling
- Try and find the pizza-flavoured easter egg

## Privacy
The app runs fully in your browser; logs are not uploaded. Exports are generated locally.
 
