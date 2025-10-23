# LogNinja
<img width="1723" height="895" alt="Untitled" src="https://github.com/user-attachments/assets/d29c693d-6035-4fbd-a5f9-b3d6ca9bbb4f" />  
A fast, client‑side log viewer built with Vite + React + TypeScript. Drag and drop logs, filter by level/text/regex, browse a timeline, and export results. Designed to work entirely in the browser (no uploads).  

## Features
- Drag & drop `.log/.txt/.csv` (UTF‑8/UTF‑16 BOM aware)
- Basic log summary view on upload
- Search: plain text or regex, with match highlighting
  - Search has both filter and highlight-only modes
  - Clear button to quickly reset search
- Histogram with automatic chunking
  - User-configurable chunk lengths
- Horizontal scroll + Wrap toggle for long lines
- Row selection + Ctrl/Cmd+C to copy the full raw line
  - Selected rows persist across filter changes (auto-scrolls to keep selected row visible)
- Bookmarks: star lines and export them (CSV/Markdown includes "Bookmarked Lines")
  - **Bookmark-only view**: Show only bookmarked lines with configurable context (±1, 3, 5, or 10 lines)
- Airlock summary (auto when filename includes `airlock`; Windows + Linux agents)

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
- Use the Wrap toggle for multi‑line viewing; disable for horizontal scrolling
- Try and find the pizza-flavoured easter egg

## Privacy
The app runs fully in your browser; logs are not uploaded. Exports are generated locally.
 
