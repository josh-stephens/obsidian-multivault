# Obsidian Multivault - Raycast Extension

## Project Overview

A Raycast extension for searching and managing notes across multiple Obsidian vaults. Forked from the original [obsidian-raycast](https://github.com/KevinBatdorf/obsidian-raycast) extension with enhanced multi-vault support, Windows compatibility, and performance optimizations.

## Documentation

- **[README.md](./README.md)** - User-facing documentation and features
- **[OPTIMIZATION_PLAN.md](./OPTIMIZATION_PLAN.md)** - Master roadmap with task list and technical details
- **[DEVELOPMENT_STORY.md](./DEVELOPMENT_STORY.md)** - Narrative of development process and lessons learned

## Development Environment

- **Primary Development**: Linux server (skippy)
- **Testing Target**: Windows machine `bishop` (via Tailscale SSH)
- **Raycast on Windows**: Uses `~/.config/raycast-x/extensions/` (NOT `~/.config/raycast/`)

## Deployment Workflow

```bash
# 1. Edit files locally on skippy

# 2. Copy modified files to bishop
scp <file> bishop:'C:\Users\josh\Projects\raycast\extensions\obsidian-multivault\...'

# 3. Build on bishop
ssh bishop "powershell -Command \"Set-Location 'C:\\Users\\josh\\Projects\\raycast\\extensions\\obsidian-multivault'; npm run build\""

# 4. Copy to Raycast extension folder
ssh bishop "powershell -Command \"Copy-Item -Path 'C:\\Users\\josh\\.config\\raycast\\extensions\\obsidian-multivault\\*' -Destination 'C:\\Users\\josh\\.config\\raycast-x\\extensions\\obsidian-multivault\\' -Recurse -Force\""
```

## Key Architecture

### Note Loading (Lazy Loading)
- `loadNotes()` in `vault.service.ts` only loads metadata initially
- Content loaded on-demand via `getNoteContent(note, filter, vault)`
- Tags extracted from first 2KB of files for performance

### Image Rendering
- Obsidian `![[image.jpg]]` syntax converted to standard markdown
- `convertObsidianImages()` resolves paths and uses `file://` protocol
- Checks: attachment folder setting, vault root, same folder as note, recursive search

### Special File Handling
- Excalidraw files detected via frontmatter and display friendly message
- Embedded images from Excalidraw extracted and displayed

### Caching
- Uses Raycast's Cache API (`@raycast/api`)
- Cache key: vault name
- Cache TTL: 30 minutes

### Performance Debugging
- `src/utils/perf.ts` - Toggle `PERF_ENABLED = true` to log performance metrics
- Logs written to `C:\Users\josh\obsidian-perf.log` (Windows) or `/tmp/obsidian-perf.log`

## Current Project Phase

**Phase 2: Structural Improvements** - See [OPTIMIZATION_PLAN.md](./OPTIMIZATION_PLAN.md)

- [x] Phase 0: Project Setup (complete)
- [x] Phase 1: Search Quick Wins (complete)
  - Fixed `tagsForNotes()` bottleneck (1593ms → 0.38ms, 4200x faster)
  - Added 150ms search debouncing
  - Title-first search optimization
  - Reduced MAX_RENDERED_NOTES to 100
- [ ] Phase 2: Structural Improvements ← **NEXT**
- [ ] Phase 3: Advanced Optimizations (optional)
- [ ] Phase 4: Security audit & Publication

## Test Vaults on Bishop

- `C:\Users\josh\Documents\Mine` - 1,276 notes (~12MB)
- `C:\Users\josh\Documents\711BF Family` - 79 notes (~0.9MB)

## Key Files Modified from Original

| File | Changes |
|------|---------|
| `src/api/vault/vault.service.ts` | Lazy loading, cross-platform paths, image conversion, Excalidraw handling |
| `src/api/cache/cache.service.ts` | 30-minute cache TTL |
| `src/utils/search.tsx` | Title-first search optimization, content search only when <20 title matches |
| `src/utils/yaml.tsx` | Fixed `tagsForNotes()` to use pre-extracted tags (was 4200x slower) |
| `src/utils/constants.tsx` | MAX_RENDERED_NOTES=100, image regex |
| `src/utils/perf.ts` | Performance debugging utility (toggle PERF_ENABLED) |
| `src/components/NoteList/NoteList.tsx` | 150ms search debouncing |
| `src/components/NoteList/NoteListItem.tsx` | Uses `useMemo` with lazy content loading |
| `src/components/NoteQuickLook.tsx` | Passes vault for image resolution |

## Known Issues Fixed

1. **Memory crash on large vaults** - Fixed with lazy content loading
2. **Windows path handling** - Fixed quote stripping in `parseVaults()`
3. **Cross-platform Obsidian config** - Added `getObsidianConfigPath()` for Win/Mac/Linux
4. **Excalidraw raw display** - Now shows friendly message with embedded images
5. **Images not rendering** - Converts `![[image]]` to standard markdown

## Security Audit (Planned)

Will use the `security-pro:security-auditor` agent before publication to check for:
- Command injection vulnerabilities
- Path traversal issues
- XSS in rendered content
- Sensitive data exposure
