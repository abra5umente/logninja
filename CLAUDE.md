# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LogNinja** is a client-side log analysis and visualization tool built with React, TypeScript, and Vite. All log processing happens entirely in the browser without uploading data to servers, making it privacy-focused while providing powerful search, filtering, and visualization capabilities.

**Tech Stack:** Vite 5.2.10, React 18.2.0, TypeScript 5.4.5, Tailwind CSS 3.4.7

## Development Commands

```bash
# Development server (binds to 0.0.0.0:5173 for LAN access)
npm run dev

# Production build (TypeScript check + Vite bundle)
npm run build

# Preview production build locally
npm run preview

# Extract Airlock summary metadata from log file
npm run airlock-summary
```

## Docker

```bash
# Build image
docker build -t logninja .

# Run container
docker run --rm -p 8080:80 logninja

# Access at http://localhost:8080
```

The Dockerfile uses a multi-stage build: Node 18 Alpine for building, Nginx Alpine for serving static assets.

## Architecture

### UI Layout

The application uses a **three-column grid layout** (`grid-cols-[280px_1fr_320px]`):

**Left Sidebar (280px - conditionally visible):**
- Level filter buttons (dynamic - only shows levels present in loaded files)
- Log summary statistics
- Export controls (CSV, Markdown, Copy, Reset)
- Airlock summary button (when applicable)

**Center Column (flexible):**
- VirtualTable (main log viewer) - front and center
- Bookmark controls (when bookmarks exist)
- Timeline histogram (horizontal, beneath table with card-style bins)

**Right Sidebar (320px - conditionally visible):**
- Search bar with regex and highlight-only modes
- Search presets dropdown
- Loaded files list with click-to-filter

**Special Elements:**
- Settings cog: Bottom-right corner
- Loading overlay: Full-screen blur with animated logo and spinner during file loading
- Airlock summary: Modal overlay (when applicable)
- Global drag-and-drop: Entire window is droppable with overlay indicator

**Empty State:**
When no files loaded, shows clean centered overlay with:
- Large "logninja." logo
- "Drag & drop log files anywhere" text
- "Browse Files..." button
- All other UI elements hidden for minimal distraction

**UI Visibility:**
All UI elements (sidebars, timeline, search) are hidden until files are loaded, providing a clean initial experience.

### Entry Points and Data Flow

**Application Bootstrap:**
- `index.html` → `main.tsx` → `App.tsx` (root component)
- App.tsx is the main state container that orchestrates all components with three-column layout

**Upload Flow:**
```
Global drag-and-drop OR Browse button
  ↓
decodeFile() handles UTF-8/UTF-16 encoding detection
  ↓
onText(text, fileName) callback in App.tsx
  ↓
parseLog(text, fileId, fileName) in lib/parse.ts
  ↓
Merge with existing entries, sort by timestamp, re-index
  ↓
Store in state (entries + loadedFiles metadata)
  ↓
UI updates via React reactivity
```

**Filtering Pipeline:**
```
All entries
  ↓
buildSearchRegex() compiles user query (lib/search.ts)
  ↓
Filter by: file IDs (multi-select), log levels (multi-select), timeRange, search query
  ↓
Memoized filtered entries
  ↓
VirtualTable renders visible rows only (virtual scrolling)
```

**File Filtering:**
- Click a file → shows only that file's entries
- Ctrl+Click files → multi-select mode (toggle files on/off)
- Click selected file again → deselects it (shows all files)
- Visual feedback: selected files at full opacity, unselected dimmed to 40%

**Level Filtering:**
- Dynamically shows only levels present in loaded/filtered files
- Click a level → shows only that level
- Ctrl+Click levels → multi-select mode (toggle levels on/off)
- Visual feedback: selected levels highlighted, unselected dimmed to 50%

### State Management

App.tsx uses **functional state updates** to prevent stale closures during multi-file uploads:

```typescript
setEntries(prevEntries => {
  const merged = [...prevEntries, ...newParsed].sort(byTime)
  return merged.map((entry, idx) => ({ ...entry, index: idx }))
})
```

**No external state management library** - uses React's built-in useState with heavy memoization (useMemo) for performance.

**LocalStorage persists:**
- Theme (light/dark, default: dark)
- Accent color (hex, default: #30F24E)
- Virtual table page size
- Timeline page size

### Core Libraries

| File | Purpose |
|------|---------|
| `lib/parse.ts` | Multi-format log parsing (11+ formats including ISO8601, Apache, Redis, MongoDB, MSI, etc.) |
| `lib/search.ts` | Regex compilation with safety checks (prevents catastrophic backtracking) |
| `lib/time.ts` | Time binning for histogram/timeline (1s to 15m intervals) |
| `lib/export.ts` | CSV and Markdown export formatting |
| `lib/airlockSummary.ts` | Airlock Digital log metadata extraction (21 fields) |
| `lib/theme.ts` | Theme persistence and CSS variable management |
| `lib/types.ts` | TypeScript type definitions (LogEntry, FiltersState, etc.) |

### Key Components

- **App.tsx** - Main state container and component orchestrator with three-column grid layout
- **VirtualTable.tsx** - High-performance virtual scrolling table with bookmarking, row selection, and dynamic line wrapping
- **TimelinePanel.tsx** - Hierarchical timeline with drill-down visualization and incremental navigation
- **LoadingOverlay.tsx** - Full-screen loading animation with blur effect, logo, and spinner
- **SearchBar.tsx** - Search input with regex and highlight-only modes
- **ExportBar.tsx** - CSV/Markdown export with clipboard support
- **LevelFilters.tsx** - Dynamic log level filtering with multi-select support
- **LogSummary.tsx** - Log statistics and metrics display
- **AirlockSummary.tsx** - Specialized Airlock log metadata display (modal)
- **SettingsSidebar.tsx** - Theme and accent color customization
- **LoadBanner.tsx** - Success notification banner after file loading

### Log Parsing (`lib/parse.ts`)

The parser supports 11+ log formats with intelligent detection:

1. ISO 8601/RFC3339
2. YYYY-MM-DD HH:mm:ss variants
3. YYYY/MM/DD HH:mm:ss
4. DMY/MDY formats (dd/MM/yyyy or MM/dd/yyyy with inference)
5. dd Mon yyyy HH:mm:ss
6. Apache/Nginx combined logs
7. Redis logs (PID:Role prefix)
8. Ruby Logger/Rails
9. MongoDB structured JSON
10. MSI (Windows Installer) logs
11. Resque format

**Performance limits:**
- Max 1,000,000 lines per file (prevents browser crashes)
- Single-pass processing, no backtracking
- Handles continuation lines (multi-line log entries)

### Search and Filtering (`lib/search.ts`)

**Search modes:**
- Plain text (default): Case-insensitive literal match with regex escaping
- Regex: User-provided patterns with PCRE-style `(?i)` support

**Safety features:**
- Max pattern length: 1000 chars
- Blocks catastrophic backtracking patterns (nested quantifiers like `.*.*`)
- Pattern validation before use

**Highlight-only mode:** Shows all entries but highlights only matches (useful for context around matches)

### Virtual Scrolling (`VirtualTable.tsx`)

**Performance optimizations:**
- Always-on virtual scrolling for both wrap and no-wrap modes
- Only renders visible rows + overscan (12 rows above/below viewport)
- Row heights:
  - No-wrap mode: 28px fixed height
  - Wrap mode: Dynamic heights (min 28px, auto-expand based on content)
  - Estimated average for wrap: 48px (used for scroll calculations)
- Highlighting disabled for >1000 visible rows
- File color coding (max 10 distinct colors)
- Handles millions of log entries without performance degradation

**Features:**
- True infinite scrolling (no pagination)
- Row selection (Ctrl/Cmd+C copies raw line)
- Bookmarking (star icon)
- Dynamic line wrapping toggle
  - Wrap OFF: Single-line rows with horizontal scroll
  - Wrap ON: Multi-line rows that adapt to content length
- Keyboard navigation

**Critical Implementation Note:**
Virtual scrolling requires a **stable, fixed container height** for proper calculations. The container uses `height: propHeight || DEFAULT_HEIGHT` (600px). Do NOT attempt to use dynamic height tracking with flex layouts (`flex: 1`) as this causes:
- Infinite loops in useEffect dependencies
- Broken scroll position tracking
- Page crashes when loading files

See NOTES.md for detailed explanation of this issue.

### Timeline System (`TimelinePanel.tsx` + `lib/time.ts`)

The timeline features a **hierarchical drill-down system** with real-time filtering that automatically adjusts to your log file's time span:

**Hierarchy Levels:**
1. **Day** (86400000ms) - For logs spanning >24 hours
2. **Hour** (3600000ms) - Drill down from days, or auto-selected for ≤24 hour spans
3. **15 Min** (900000ms) - Drill down from hours
4. **Minute** (60000ms) - Drill down from 15-minute bins
5. **Second** (1000ms) - Deepest level

**Auto-level Detection:**
- Time span ≤24 hours: Starts at hourly view (24 bins)
- Time span >24 hours: Starts at daily view

**Drill-Down Navigation:**
- Click any bin → **filters log view to that time range AND drills down to next level**
- Incremental back navigation: "← Back to Hours", "← Back to Days", etc.
- Breadcrumb shows current level: "Viewing: Hour (24 bins)"
- Log table filters at ALL drill levels, not just the deepest
- History stack enables one-level-at-a-time back navigation

**UI Design:**
- Card-based bins (min 40px wide) with borders and spacing for clear separation
- Event count displayed inside each bin button
- Horizontal date/time labels (no rotation)
- Selected bins highlighted, unselected dimmed
- Bins dynamically scale to fill available width
- Min height: 60px to prevent header cutoff
- Fixed statistics panel with level breakdown shown when filtering

**ChunkBin structure:**
```typescript
{
  start: Date,
  end: Date,
  count: number,
  levelCounts: { ERROR?: number, WARN?: number, ... }
}
```

**Example:** For a 273-day log file:
1. Start: Daily bins showing events per day
2. Click "Jan 15" → Hourly bins for Jan 15
3. Click "14:00" → 15-minute bins for 14:00-15:00
4. Click "14:30" → Minute bins for 14:30-14:45
5. Click "14:37" → Second bins for 14:37:00-14:38:00
6. Click any second → Filters table to that exact second

**Performance Note:**
For files spanning large time ranges (e.g., >1 year), the timeline uses an iterative approach to avoid stack overflow:
- Min/max timestamp calculation uses a simple loop instead of spread operators
- Prevents "Maximum call stack size exceeded" errors with hundreds of thousands of entries

### Loading Animation System (`LoadingOverlay.tsx`)

The app features a **polished loading experience** that provides visual feedback during file processing:

**Animation Stages:**
1. **Loading Stage**: Full-screen blur overlay fades in (300ms)
   - Large "logninja." logo in accent color
   - Spinning loader SVG below logo
   - "Loading X files..." text
   - Background blurs to 12px

2. **Complete Stage**: Processing finished (600ms pause)
   - Spinner fades out
   - Checkmark animates in with scale transition
   - Brief celebration moment

3. **Reveal Stage**: Transition to UI (500ms fade)
   - Overlay fades out completely
   - Background unblurs
   - All UI elements (already rendered behind) revealed
   - User transitions smoothly into log viewer

**Implementation:**
- State: `loadingStage` ('idle' | 'loading' | 'complete')
- Non-blocking: files parse while animations play
- Minimum display time ensures polish even for fast loads
- CSS transitions handle all blur/fade effects
- Z-index 50 ensures overlay stays on top

## Important Patterns

### Functional State Updates

Always use functional updates when modifying state that depends on previous state:

```typescript
// Good - prevents stale closures
setEntries(prev => [...prev, newEntry])

// Bad - can cause stale closure bugs
setEntries([...entries, newEntry])
```

### Memoization Strategy

Use useMemo for expensive computations that depend on state:

```typescript
const filtered = useMemo(() => {
  return entries.filter(matchesFilters)
}, [entries, filters])
```

### Component Communication

All state lives in App.tsx. Child components are controlled via props:
- Props flow down (data + callbacks)
- Events flow up (via callbacks)
- No prop drilling (components are shallow)

## File Structure

```
/src
  ├── App.tsx              # Main component, state container
  ├── main.tsx             # Entry point
  ├── index.css            # Tailwind + custom styles
  ├── components/          # UI components
  └── lib/                 # Utilities and pure functions
      ├── parse.ts         # Log parsing
      ├── search.ts        # Regex compilation
      ├── time.ts          # Time binning
      ├── export.ts        # Export formatting
      ├── airlockSummary.ts
      ├── theme.ts
      └── types.ts
```

## Airlock Integration

When a filename matches `/airlock[\w.-]*\.log$/i`, the app:
1. Extracts 21 metadata fields using custom regex patterns
2. Displays AirlockSummary component with collapsible table
3. Allows click-to-filter on any field value

Fields include: Airlock Version, Proxy Config, Primary Server, Interops, Policy DB info, Audit Mode, AutoUpdate status, etc.

## Build Configuration

**Vite (`vite.config.ts`):**
- React plugin for JSX
- Dev/preview servers bind to 0.0.0.0 (LAN accessible)

**TypeScript (`tsconfig.json`):**
- Target: ES2020
- Strict mode enabled
- JSX: react-jsx (new transform)
- Module resolution: bundler

**Tailwind (`tailwind.config.cjs`):**
- Dark mode via class strategy
- Custom colors and utilities
- CSS variables for accent color (`--accent`)

## Keyboard Shortcuts

- `/` - Focus search input
- `Ctrl/Cmd+K` - Open command palette
- `Ctrl/Cmd+C` (with row selected) - Copy raw line

## Common Development Tasks

When adding new log format support:
1. Add regex pattern to `lib/parse.ts` detection chain
2. Test with sample log file
3. Update README.md "Supported Formats" section

When adding new filter types:
1. Add to FiltersState type in `lib/types.ts`
2. Update filtering logic in App.tsx filtered useMemo
3. Add UI control in appropriate component
4. Ensure filter state is included in export summaries

**Current FiltersState fields:**
- `selectedFiles: string[] | null` - Multi-select file filtering
- `selectedLevels: LogLevel[] | null` - Multi-select level filtering
- `selectedLevel: LogLevel | null` - Deprecated, kept for compatibility
- `query: string` - Search query
- `useRegex: boolean` - Regex mode toggle
- `timeRange: {start: Date, end: Date} | null` - Timeline filter
- `highlightOnly: boolean` - Highlight without filtering
- `showBookmarksOnly: boolean` - Bookmark-only view
- `bookmarkContext: number` - Context lines around bookmarks

When modifying state structure:
1. Update types in `lib/types.ts`
2. Use functional updates to prevent stale closures
3. Update affected useMemo dependencies
4. Check localStorage persistence if applicable

## Performance Considerations

**Current limits:**
- 1,000,000 lines per file (hard cap in parser)
- Highlighting disabled for >1000 visible rows
- 10 distinct file colors max

**For larger datasets, consider:**
- Web Workers for off-main-thread parsing
- IndexedDB for log persistence instead of RAM
- Streaming log ingestion instead of full-file upload
