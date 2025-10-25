# Development Notes

## Virtual Scrolling Fix (2025-10-25)

### Issue
The infinite scroll in VirtualTable.tsx was breaking, causing:
- Only ~45 lines to load initially
- Scrolling wouldn't load more lines
- Page would crash/die when loading log files

### Root Cause
An infinite loop was introduced when trying to add dynamic container height tracking:

1. **Infinite Loop**: `containerHeight` state was in the useEffect dependency array `[rows.length, useFullHeight, containerHeight]`
   - The effect would update `containerHeight`
   - This triggered the effect to re-run (because containerHeight was a dependency)
   - Loop continued infinitely → page crash

2. **State Updates During Scroll**: Setting `containerHeight` inside the scroll handler caused performance issues

3. **Unstable Height Calculations**: Flex layout (`flex: 1`) with dynamic height tracking didn't work well with virtual scrolling, which needs a stable, known height for calculating visible rows

### Solution
Reverted to the simple, working approach from commit 9ac82c6:

- **Remove** `containerHeight` state tracking
- **Use** fixed height: `propHeight || DEFAULT_HEIGHT` (600px)
- **Simplify** scroll effect to only depend on `[rows.length]`
- **Remove** conditional flex layout styling
- **Keep** fixed height container: `style={{ height, overflow: 'auto' }}`

### Key Lesson
**Virtual scrolling requires stable, known container heights.** Dynamic height tracking with flex layouts introduces complexity that can cause infinite loops and breaks the virtual scroll calculations.

The virtual window calculation (`Math.ceil(height / rowHeight) + 2 * OVERSCAN`) needs a stable `height` value to work correctly.

### Working Code Pattern
```typescript
// Simple, stable height
const height = propHeight || DEFAULT_HEIGHT

// Simple scroll tracking - no state updates in handler
useEffect(() => {
  const el = containerRef.current
  if (!el) return
  const onScroll = () => setScrollTop(el.scrollTop)
  el.addEventListener('scroll', onScroll)
  return () => el.removeEventListener('scroll', onScroll)
}, [rows.length])

// Fixed height container
<div ref={containerRef} style={{ height, overflow: 'auto' }}>
```

### Files Modified
- `src/components/VirtualTable.tsx`
