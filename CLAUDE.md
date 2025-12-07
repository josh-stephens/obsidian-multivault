# Obsidian Multivault - Raycast Extension

## Project Overview

A Raycast extension for searching and managing notes across multiple Obsidian vaults. Forked from the original [obsidian-raycast](https://github.com/KevinBatdorf/obsidian-raycast) extension with enhanced multi-vault support, Windows compatibility, and performance optimizations.

## Documentation

- **[README.md](./README.md)** - User-facing documentation and features
- **[OPTIMIZATION_PLAN.md](./OPTIMIZATION_PLAN.md)** - Master roadmap with task list and technical details
- **[DEVELOPMENT_STORY.md](./DEVELOPMENT_STORY.md)** - Narrative of development process and lessons learned

## Project Status

**All phases complete - Ready for publication**

- [x] Phase 0: Project Setup
- [x] Phase 1: Search Quick Wins (4200x faster tag loading, debouncing, title-first search)
- [x] Phase 2: Structural Improvements (lazy loading, two-phase content search)
- [x] Phase 3: Security Audit (path traversal fixes, error handling)
- [ ] Phase 4: Publication

## Development Environment

- **Cross-platform**: Developed/tested on Linux and Windows
- **Raycast on Windows**: Uses `~/.config/raycast-x/extensions/` (NOT `~/.config/raycast/`)

## Deployment Workflow

```bash
# 1. Edit files locally

# 2. Build the extension
npm run build

# 3. For Windows Raycast beta: copy to raycast-x folder
# npm run build outputs to ~/.config/raycast/, but Raycast Windows reads from ~/.config/raycast-x/
```

**Windows Note**: `npm run build` outputs to `~/.config/raycast/`, but Raycast Windows beta reads from `~/.config/raycast-x/`. Copy the built extension to the correct location after building.

## Key Architecture

### Note Loading (Lazy Loading)
- `loadNotes()` in `vault.service.ts` only loads metadata initially
- Content loaded on-demand via `getNoteContent(note, filter, vault)`
- Tags extracted from first 2KB of files for performance

### Search Flow
1. **Debouncing**: 150ms delay before search executes
2. **Title/Path Search**: Fast Fuse.js fuzzy search on metadata only
3. **Content Search**: Only triggered when title matches < 20, loads content on-demand
4. **Result Limiting**: MAX_RENDERED_NOTES = 100

### Image Rendering
- Obsidian `![[image.jpg]]` syntax detected and processed by `convertObsidianImages()`
- **External URLs** (https://) render normally in Raycast markdown
- **Local images** show as `📷 filename` placeholders (Raycast limitation - see below)
- Path traversal protection prevents accessing files outside vault

#### Raycast Image Limitation (Windows)
Raycast's markdown renderer only supports images from:
1. The extension's `assets/` folder
2. HTTPS URLs

Local file paths do NOT work. Approaches tested (all failed):
1. Base64 data URIs - Silently doesn't render
2. `~` paths (`~/Documents/...`) - Doesn't work on Windows
3. Absolute paths with forward slashes (`C:/Users/...`) - Doesn't render
4. `file://` URL format - Doesn't render
5. Raw absolute paths with backslashes - Shows raw markdown

Current solution: Show `📷 filename` placeholder for local images.

### Special File Handling
- Excalidraw files detected via frontmatter and display friendly message
- Embedded images from Excalidraw extracted and displayed

### Caching
- Uses Raycast's Cache API (`@raycast/api`)
- Cache key: vault name
- Cache TTL: 30 minutes

### Performance Debugging
- `src/utils/perf.ts` - Toggle `PERF_ENABLED = true` to log metrics
- Logs written to `~/.obsidian-raycast-perf.log`

## Test Vaults

Example vault configurations for testing:
- Large vault: 1,000+ notes (~12MB) - tests lazy loading performance
- Small vault: ~100 notes (~1MB) - tests basic functionality

## Key Files Modified from Original

| File | Changes |
|------|---------|
| `src/api/vault/vault.service.ts` | Lazy loading, cross-platform paths, image conversion, Excalidraw handling, path traversal protection |
| `src/api/vault/notes/notes.service.ts` | Path traversal protection for note creation |
| `src/api/vault/notes/bookmarks/bookmarks.service.ts` | JSON parse error handling |
| `src/api/cache/cache.service.ts` | 30-minute cache TTL |
| `src/utils/search.tsx` | Title-first search, two-phase content search, fixed Fuse.js bug |
| `src/utils/yaml.tsx` | Fixed `tagsForNotes()` to use pre-extracted tags (4200x faster) |
| `src/utils/constants.tsx` | MAX_RENDERED_NOTES=100, image regex |
| `src/utils/perf.ts` | Performance debugging utility, dynamic log path |
| `src/components/NoteList/NoteList.tsx` | 150ms search debouncing |
| `src/components/NoteList/NoteListItem.tsx` | Uses `useMemo` with lazy content loading |
| `src/components/NoteQuickLook.tsx` | Passes vault for image resolution |

## Security Audit Completed

All issues found and fixed on 2025-11-25:

| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| CRITICAL | Path traversal in note creation | `notes.service.ts` | `isPathWithinDirectory()` + sanitization |
| HIGH | Path traversal in image resolution | `vault.service.ts` | `isPathWithinVault()` + sanitization |
| MEDIUM | Hardcoded username in log path | `perf.ts` | Changed to `os.homedir()` |
| LOW | Unhandled JSON parse error | `bookmarks.service.ts` | Added try-catch |

## Known Issues Fixed

1. **Memory crash on large vaults** - Fixed with lazy content loading
2. **Windows path handling** - Fixed quote stripping in `parseVaults()`
3. **Cross-platform Obsidian config** - Added `getObsidianConfigPath()` for Win/Mac/Linux
4. **Excalidraw raw display** - Now shows friendly message with embedded images
5. **Images not rendering** - External URLs work; local images show placeholder (Raycast limitation)
6. **React useMemo null error** - Fixed deployment workflow (raycast vs raycast-x)
7. **Fuse.js content search bug** - Removed broken "content" key, added two-phase search

## Known Limitations

1. **Local image preview on Windows** - Raycast's markdown renderer doesn't support local file paths; shows `📷 filename` placeholder instead

## GitHub Issues for Project Tracking

Use GitHub issues for persistent state across Claude sessions:

- **Repository**: https://github.com/josh-stephens/obsidian-multivault/issues
- **Labels**: `enhancement`, `bug`, `performance`, `security`, `react`, `reliability`, `completed`

```bash
# Create issue
gh issue create -R josh-stephens/obsidian-multivault --title "Title" --body "Description" --label "label1,label2"

# Close with comment
gh issue close NUM -R josh-stephens/obsidian-multivault -c "Completed in commit abc123"

# List issues
gh issue list -R josh-stephens/obsidian-multivault
```
