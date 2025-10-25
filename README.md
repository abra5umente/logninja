# LogNinja
<img width="1723" height="895" alt="Untitled" src="https://github.com/user-attachments/assets/d29c693d-6035-4fbd-a5f9-b3d6ca9bbb4f" />  
A fast, client‑side log viewer built with Vite + React + TypeScript. Drag and drop logs, filter by level/text/regex, browse a timeline, and export results. Designed to work entirely in the browser (no uploads).  

## Features

### UI & Layout
- **Three-column layout**: Controls on left, log viewer center, search/files on right
- **Clean initial state**: When no files are loaded, only the LogNinja logo and file browser are shown - all other UI elements appear after loading
- **Loading animations**: Smooth blur overlay with animated logo and spinner during file processing, with checkmark completion state
- **Global drag & drop**: Drop `.log/.txt/.csv` files anywhere on the window (UTF‑8/UTF‑16 BOM aware)
- **Modal interactions**: Settings sidebar, Airlock summary modal with ESC/click-outside to dismiss

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
- **File filtering** (multi-file support):
  - Click a file → filter to show only that file's entries
  - Ctrl+Click files → multi-select mode (toggle multiple files on/off)
  - Click selected file again → deselect it (shows all files)
  - Visual feedback: selected files at full opacity, unselected dimmed
- **Level filtering**: ERROR, WARN, INFO, DEBUG, TRACE, UNKNOWN
  - Dynamically shows only levels present in loaded/filtered files
  - Click a level → filter to that level only
  - Ctrl+Click levels → multi-select mode (toggle multiple levels on/off)
  - Visual feedback: selected levels highlighted, unselected dimmed
- **Time range filtering** via timeline drill-down
- **Reset button**: Clears all filters (search, files, levels, time range) at once

### Timeline & Navigation
- **Hierarchical timeline with drill-down**: Navigate long time spans efficiently
  - Auto-detects starting level (Day for >24hr spans, Hour for ≤24hr)
  - Five levels: Day → Hour → 15min → Minute → Second
  - **Filters log view at every drill level** - not just at the deepest level
  - Incremental back navigation: "← Back to Hours", "← Back to Days", etc.
  - Card-based bin design with event counts inside each bin
  - Horizontal date/time labels for easy reading
  - Visual histogram showing log level breakdown for each time bin
  - Fixed statistics panel prevents layout shift during navigation
  - Optimized for large time spans (handles year+ log files without stack overflow)

### Bookmarks & Export
- Bookmarks: star lines and export them (CSV/Markdown includes "Bookmarked Lines")
  - **Bookmark-only view**: Show only bookmarked lines with configurable context (±1, 3, 5, or 10 lines)
- Export to CSV or Markdown
- Copy all filtered entries to clipboard

### Special Features
- **Airlock summary**: Auto-detected for Airlock Digital logs (modal with 21 metadata fields; Windows + Linux agents)

## Screenshots
Enhanced Airlock Digital log support:
<img width="1722" height="898" alt="Untitled" src="https://github.com/user-attachments/assets/07732c55-1641-40c9-b96c-7559745a7d94" />  
Log Summary view:
<img width="1723" height="895" alt="Untitled" src="https://github.com/user-attachments/assets/d29c693d-6035-4fbd-a5f9-b3d6ca9bbb4f" />  
Markdown Summary export view:
<img width="1722" height="892" alt="Untitled" src="https://github.com/user-attachments/assets/ea9e6e09-a7a4-4ef9-9080-07ba479a41dc" />  
Settings with light/dark mode themes and accent colour picker:
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
- **Wrap toggle**: Enable for multi-line rows that adapt to content length; disable for single-line rows with horizontal scrolling
- **Timeline drill-down**: Click any bin to filter and explore deeper time ranges (Day → Hour → 15min → Minute → Second)
- **Multi-select filtering**:
  - `Ctrl/Cmd+Click` on files to select multiple files simultaneously
  - `Ctrl/Cmd+Click` on log levels to select multiple levels simultaneously
  - Click selected item again to deselect it
- **Global drag & drop**: Drop log files anywhere on the page, not just the browse button
- `ESC` or click outside to dismiss settings/Airlock modals
- Virtual scrolling works smoothly in both wrap and no-wrap modes for optimal performance
- Try and find the pizza-flavoured easter egg

## Privacy

The app runs fully in your browser; logs are not uploaded. Exports are generated locally.
