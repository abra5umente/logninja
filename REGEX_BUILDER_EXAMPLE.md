# Regex Builder Tool - Usage Example

## Overview

The Regex Builder tool provides a visual interface for constructing complex regex patterns without needing to know regex syntax.

## How to Use

1. Click the **"Build Query"** button in the search sidebar (accent-colored button)
2. A modal will open with the Regex Builder interface
3. Add segments to build your pattern
4. Click **"Apply to Search"** to use the generated regex

## Example: Finding "FILE CHECK" with path exclusions

To find log lines containing `FILE CHECK` and `C:/Program Files/<anything except abc>/`:

### Steps:

1. **Add Literal segment #1**
   - Type: `Literal`
   - Value: `FILE CHECK`
   - This matches the exact text "FILE CHECK"

2. **Add Wildcard segment #2**
   - Type: `Wildcard`
   - This matches any text between FILE CHECK and the path (e.g., spaces, newlines)

3. **Add Literal segment #3**
   - Type: `Literal`
   - Value: `C:/Program Files/`
   - This matches the exact path prefix

4. **Add Not segment #4**
   - Type: `Not`
   - Value: `abc`
   - This matches any directory name EXCEPT "abc"

5. **Add Literal segment #5**
   - Type: `Literal`
   - Value: `/`
   - This matches the trailing slash

### Generated Regex:

```regex
FILE CHECK.*?C:\/Program Files\/(?!abc)[^\s\/]+\/
```

### Explanation:

- `FILE CHECK` - Literal match
- `.*?` - Match any characters (non-greedy)
- `C:\/Program Files\/` - Literal path (special chars escaped)
- `(?!abc)` - Negative lookahead: NOT "abc"
- `[^\s\/]+` - Match one or more non-whitespace, non-slash characters
- `\/` - Literal slash

## Segment Types

### Literal
- Matches exact text
- Special regex characters are automatically escaped
- Example: `C:/Program Files/` → `C:\/Program Files\/`

### Wildcard
- Matches any text (non-greedy)
- Generates: `.*?`
- Use between literal segments to match variable content

### Not
- Matches anything EXCEPT the specified value
- Uses negative lookahead with character class
- Example: NOT "abc" → `(?!abc)[^\s\/]+`
- Useful for excluding specific paths, filenames, or values

### Custom
- Enter your own regex pattern
- No escaping applied
- For advanced users who want precise control

## Tips

- Use **Up/Down arrows** to reorder segments
- The **Preview** section shows the generated regex in real-time
- Click **Copy** to copy the regex to clipboard
- Segments are joined in order from #1 to #N
- Invalid patterns are highlighted with warnings

## Common Patterns

### Match specific log level with variable message
1. Literal: `ERROR:`
2. Wildcard
3. Literal: `database`

### Match paths excluding specific directories
1. Literal: `C:/Users/`
2. Not: `admin`
3. Literal: `/Documents/`

### Match timestamps with variable content
1. Custom: `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}`
2. Wildcard
3. Literal: `Connection failed`
