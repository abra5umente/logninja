# LogNinja
<img width="1723" height="895" alt="Untitled" src="https://github.com/user-attachments/assets/d29c693d-6035-4fbd-a5f9-b3d6ca9bbb4f" />  
A fast, client‑side log viewer built with Vite + React + TypeScript. Drag and drop logs, filter by level/text/regex, browse a timeline, and export results. Designed to work entirely in the browser (no uploads).  

## Features

### UI & Layout
- **Three-column layout**: Controls on left, log viewer center, search/files on right
- **Clean initial state**: When no files are loaded, only the LogNinja logo and file browser are shown - all other UI elements appear after loading
- **Loading animations**: Smooth blur overlay with animated logo and spinner during file processing, with checkmark completion state
- **Global drag & drop**: Drop log files anywhere on the window, rotated ones like `server.log.1` included (UTF‑8/UTF‑16 aware; archives and other binary files are skipped with a note)
- **Modal interactions**: Settings sidebar, Airlock summary modal with ESC/click-outside to dismiss
- **What's new**: a short popup lists new features once per release (remembered in your browser only, nothing is sent anywhere); reopen it from settings or the command palette

### Log Viewing
- **High-performance virtual scrolling**: Handles millions of log entries smoothly
  - True infinite scrolling (no pagination)
  - Dynamic line wrapping with auto-height rows
  - **Wrap toggle**: Switch between single-line (horizontal scroll) and multi-line (auto-wrap) views
- **Multi-file support**: Load multiple log files with color-coded file indicators
- Basic log summary view on upload
- Row selection + Ctrl/Cmd+C to copy the full raw line
  - Selected rows persist across filter changes (auto-scrolls to keep selected row visible)

### Search & Filtering
- **Search**: plain text or regex, with match highlighting
  - Filter or highlight-only modes
  - Clear button to quickly reset search
  - Search presets for common queries
  - **Query builder** ("build query"): list the words a line should have (any or all of them) and the ones it shouldn't, with `*` as a wildcard (`Program Files\*\app.exe`) or a regex per term, and a live preview of matching lines
  - **Saved queries**: name a query in the builder to keep it (stored in your browser); it shows up under the presets, and "edit query" reopens it in the builder
- **File filtering** (multi-file support):
  - Click a file → filter to show only that file's entries
  - Ctrl+Click files → multi-select mode (toggle multiple files on/off)
  - Click selected file again → deselect it (shows all files)
  - Visual feedback: selected files at full opacity, unselected dimmed
- **Level filtering**: ERROR, WARN, INFO, DEBUG, TRACE, UNKNOWN
  - Dynamically shows only levels present in loaded/filtered files
  - Click a level → toggle it on or off (pick as many as you like; none picked shows every level)
  - Ctrl/Cmd+Click a level → show only that level (again to clear)
  - Visual feedback: selected levels highlighted, unselected dimmed
- **Time range filtering** by clicking or dragging on the timeline
- **Reset button**: Clears all filters (search, files, levels, time range) at once

### Log Patterns
- **Patterns view** (the "rows / patterns" switch above the table, or "Show Log Patterns" in the command palette): lines that differ only in their variable parts collapse into one pattern, e.g. `request completed in <n>ms`
  - Numbers, IPs, UUIDs, hashes, timestamps, emails, URLs, file paths and session-style ids are blanked out; everything else (like `Result=Blocked` vs `Result=Allowed`) keeps patterns apart
  - Each pattern shows its count and share of rows, level mix, first and last seen, and a sparkline of when it shows up
  - Sort by most common, **rarest** (the odd lines out), most errors, or newest (patterns that first appeared latest)
  - Click a pattern to filter the table to its rows (via a regex in the search box); "first row" jumps to its first occurrence
  - Works on whatever the other filters leave, so drag a range on the timeline to see what was happening in a burst
  - Stack traces group by their first line; big files are grouped in slices so the page stays responsive

### Timeline & Navigation
- **Stacked timeline**: each bar is split by level (errors and warnings on the baseline), so bursts of errors stand out at a glance
  - Bar width adapts to what you're looking at (1 sec up to days), always lined up with your local clock
  - Hover a bar to see its time span, entry count and per-level counts
  - **Click a bar** to zoom into it, or **drag across bars** to zoom into a custom range; both filter the log view
  - "← zoom out" steps back one zoom, "show all" goes back to the full span
  - Follows your file, level and search filters; in find mode, search hits get their own strip under the bars
  - Keyboard: focus the timeline, then arrow keys move between bars, Enter zooms in, Backspace zooms out
  - Fixed statistics panel prevents layout shift during navigation
  - Optimized for large time spans (handles year+ log files without stack overflow)

### Bookmarks & Export
- Bookmarks: star lines and export them (CSV/Markdown includes "Bookmarked Lines")
  - **Bookmark-only view**: Show only bookmarked lines with configurable context (±1, 3, 5, or 10 lines), within the current level, file and time filters
- Export to CSV or Markdown
- Copy all filtered entries to clipboard

### Special Features
- **Airlock summary**: Auto-detected for Airlock Digital logs (modal with 71 fields grouped into Agent, Host, Server connection, Policy and Executions; Windows, Linux and macOS agents, including 7.x debug logs from all three). Click a value to search the log for the lines behind it

## Screenshots
Enhanced Airlock Digital log support:
<img width="1722" height="898" alt="Untitled" src="https://github.com/user-attachments/assets/07732c55-1641-40c9-b96c-7559745a7d94" />  
Log Summary view:
<img width="1723" height="895" alt="Untitled" src="https://github.com/user-attachments/assets/d29c693d-6035-4fbd-a5f9-b3d6ca9bbb4f" />  
Markdown Summary export view:
<img width="1722" height="892" alt="Untitled" src="https://github.com/user-attachments/assets/ea9e6e09-a7a4-4ef9-9080-07ba479a41dc" />  
Settings with system / light / dark modes and five colour palettes:
<img width="1723" height="896" alt="Untitled" src="https://github.com/user-attachments/assets/57ec2c79-c6da-499e-b930-806a8770eaba" />  
Highlight search mode:
<img width="1723" height="899" alt="Untitled" src="https://github.com/user-attachments/assets/4b4c73d2-a22a-4311-94e7-e64f9f58b847" />  

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
- Airlock agent (Linux): `YYYY-MM-DD HH:mm:ss INFO|WARN|ERROR|DEBUG message` and `FILE CHECK Filename=... Result="..."` (blocked = ERROR, blocked in audit mode = WARN, allowed = INFO)
- Airlock agent (macOS): the same lines as the Linux agent, with file names that contain a space written in quotes (`Filename="/Applications/Some App.app/..."`), plus `YYYY-MM-DD HH:mm:ss INFO  FILE CHECK Filename: <path>, OpType: 11, Result: ...` for Apple's own binaries (level from the result), `FILE CHECK Extension Title="..." ... Browser="..." Result="..."` for browser extensions (blocked = ERROR, blocked in audit mode = WARN) and `INFO  ERROR: ...` lines such as `ERROR: es_new_client() failed with 4`, which are marked ERROR
- Airlock agent (Windows): tab-separated `MM/DD/YYYY h:mm:ss AM|PM`, kind (`INFO|WARNING|ERROR|DEBUG|FILE CHECK|FILE PRE-CHECK`), thread id, message. `FILE CHECK ... Result: ...` and `[EXT-BLOCK] Extension Title: ... Result: ...` take their level from the result (blocked = ERROR, blocked in audit mode or run in PowerShell Constrained Language Mode = WARN, allowed = INFO); the `Blocking Reasons:` line joins its `FILE CHECK` row; the thread id is kept as `[1234]` at the start of the message
- Airlock server services (Go logger): `YYYY/MM/DD HH:mm:ss file.go:123: message`
- Airlock server workers: `[YYYY-MM-DD HH:mm:ss] [Tag] message`, `[<ISO ts>] message`
- Airlock server activity: `ServerActivityMessage|dd/MM/yyyy hh:mm:ss AM|Category|user|message`
- Phusion Passenger: `[ N YYYY-MM-DD HH:mm:ss.SSSS pid/thread file.cpp:123 ]: message`
- `date` output: `Mon Jan  5 08:00:00 AEDT 2026 - message`
- Resque job lines (`*** got: ...`) and other lines with no timestamp before the first timestamped line are kept as rows without a time

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

Or skip the build and run the published image: `docker run --rm -p 8080:80 ghcr.io/abra5umente/logninja:main`

CI publishes an image after the checks pass on every push to `main`: `:main` follows the branch and `:sha-<commit>` pins one build.
 
## Keyboard & Tips
- `/` focuses search, `Ctrl/Cmd+K` opens command palette
- Click a row, then `Ctrl/Cmd+C` to copy its full raw text
- **Wrap toggle**: Enable for multi-line rows that adapt to content length; disable for single-line rows with horizontal scrolling
- **Timeline zoom**: Click a bar to zoom in, or drag across bars to pick a range
- **Multi-select filtering**:
  - `Ctrl/Cmd+Click` on files to select multiple files simultaneously
  - Click log levels to toggle them on and off; `Ctrl/Cmd+Click` shows only that level
  - Click selected item again to deselect it
- **Global drag & drop**: Drop log files anywhere on the page, not just the browse button
- `ESC` or click outside to dismiss settings/Airlock modals
- Virtual scrolling works smoothly in both wrap and no-wrap modes for optimal performance
- Try and find the pizza-flavoured easter egg

## Privacy

The app runs fully in your browser; logs are not uploaded. Exports are generated locally.
