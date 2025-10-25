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

### Entry Points and Data Flow

**Application Bootstrap:**
- `index.html` → `main.tsx` → `App.tsx` (root component)
- App.tsx is the main state container that orchestrates all components

**Upload Flow:**
```
FileDropZone (drag/drop files)
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
Filter by: level, timeRange, search query
  ↓
Memoized filtered entries
  ↓
VirtualTable renders visible rows only (virtual scrolling)
```

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

- **App.tsx** - Main state container and component orchestrator
- **VirtualTable.tsx** - High-performance virtual scrolling table with bookmarking, row selection, and dynamic line wrapping
- **TimelinePanel.tsx** - Histogram visualization with configurable bin sizes
- **FileDropZone.tsx** - Multi-file drag-drop with encoding detection
- **SearchBar.tsx** - Search input with regex and highlight-only modes
- **ExportBar.tsx** - CSV/Markdown export with clipboard support
- **AirlockSummary.tsx** - Specialized Airlock log metadata display
- **SettingsSidebar.tsx** - Theme and accent color customization

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

### Timeline System (`lib/time.ts`)

Bins entries by configurable time intervals for histogram visualization.

**Available bin sizes:** 1s, 5s, 15s, 30s, 1m, 5m, 15m

**ChunkBin structure:**
```typescript
{
  start: Date,
  end: Date,
  count: number,
  levelCounts: { ERROR?: number, WARN?: number, ... }
}
```

Clicking a bin sets the timeRange filter to show only entries in that interval.

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
