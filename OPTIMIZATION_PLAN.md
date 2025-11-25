# Project Roadmap & Optimization Plan

> Generated: 2025-11-25
> Updated: 2025-11-25
> Status: **All Phases Complete - Ready for Publication**

## Project Goals

1. ~~Fix critical bugs preventing Windows usage~~ **DONE**
2. ~~Optimize search performance for large vaults~~ **DONE**
3. ~~Run security audit before release~~ **DONE**
4. Publish as open source with full documentation

---

## Development Story

This extension started as a fork of the original [obsidian-raycast](https://github.com/KevinBatdorf/obsidian-raycast) extension. During development on Windows (via Tailscale SSH to a Windows machine called "bishop"), we discovered and fixed several critical issues while adding new features.

### Issues Discovered & Fixed

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Extension not loading on Windows | Raycast Windows uses `~/.config/raycast-x/` not `~/.config/raycast/` | Manual copy to correct folder |
| "No Vaults found" error | Quoted paths not parsed correctly | Rewrote `parseVaults()` to handle quotes |
| "JS heap out of memory" crash | Loading all note content upfront for 1200+ notes | Implemented lazy loading |
| Excalidraw files display raw JSON | No special handling for Excalidraw format | Detect and show friendly message |
| Images not rendering | Obsidian `![[image]]` syntax not converted | Convert to standard markdown with `file://` paths |
| Cross-platform config paths | macOS-only Obsidian config path | Added `getObsidianConfigPath()` for Win/Mac/Linux |
| React useMemo null error | raycast-x folder had source files instead of built JS | Fixed deployment workflow |

---

## Master Task List

### Phase 0: Project Setup [COMPLETE]
- [x] Fix critical Windows bugs
- [x] Implement lazy loading for large vaults
- [x] Add image attachment rendering
- [x] Handle Excalidraw files gracefully
- [x] Create project documentation (CLAUDE.md, OPTIMIZATION_PLAN.md)
- [x] Initialize git repository
- [x] Create comprehensive README with credits
- [x] Add DEVELOPMENT_STORY.md with full narrative
- [x] Create GitHub repository (private): https://github.com/josh-stephens/obsidian-multivault

### Phase 1: Search Quick Wins [COMPLETE]
- [x] **1.1 Add Search Debouncing** - 150ms debounce in NoteList.tsx
- [x] **1.2 Pre-build Fuse Index** - SKIPPED (search already fast enough)
- [x] **1.3 Title-First Search** - Only searches content when <20 title matches
- [x] **1.4 Increase Cache TTL** - 30 minutes (was 5 minutes)
- [x] **1.5 Fix tagsForNotes() bottleneck** - Was reading ALL files twice (1593ms → 0.38ms, 4200x faster!)
- [x] **1.6 Reduce MAX_RENDERED_NOTES** - 1000 → 100 items
- [x] **1.7 Add perf.ts utility** - Toggle PERF_ENABLED for debugging

### Phase 2: Structural Improvements [COMPLETE]
- [x] **2.1 Lazy Content Loading** - Two-phase search in `search.tsx` (title/path first, content only when <20 matches)
- [x] **2.2 Progressive Results** - Title matches shown first
- [x] **2.3 Fix Fuse.js Bug** - Removed broken "content" key (notes have no content due to lazy loading), added two-phase content search to `filterNotesFuzzy()`
- [x] **2.4 Index Content Excerpt** - SKIPPED (not needed with lazy loading)
- [x] **2.5 Active Vault Feature** - SmartVaultSelection now wired to all main commands, auto-selects active vault, Cmd+Shift+V to switch
- [x] **2.6 Image Rendering** - Fixed by converting to base64 data URIs (Raycast doesn't support file:// URLs)
- [x] **2.7 Settings UX** - Reorganized preferences with section titles, better order, clearer descriptions

### Phase 3: Advanced Optimizations [SKIPPED]
- [ ] **3.1 Switch to MiniSearch** - Not needed, Fuse.js performs well
- [ ] **3.2 Background Index Updates** - Not needed with current cache TTL

### Phase 4: Security & Publication [COMPLETE]
- [x] Run security audit
- [x] Fix path traversal vulnerabilities in `notes.service.ts`
- [x] Fix path traversal vulnerabilities in `vault.service.ts` (image resolution)
- [x] Fix hardcoded username in `perf.ts`
- [x] Add error handling to `bookmarks.service.ts`
- [x] Final testing on Windows (bishop)
- [ ] Publish to GitHub (public)
- [ ] Submit to Raycast Store (optional)

---

## Security Audit Results

Security audit completed on 2025-11-25. All critical and high-severity issues fixed:

| Severity | Issue | File | Fix |
|----------|-------|------|-----|
| CRITICAL | Path traversal in note creation | `notes.service.ts` | Added `isPathWithinDirectory()` validation + input sanitization |
| HIGH | Path traversal in image resolution | `vault.service.ts` | Added `isPathWithinVault()` validation + input sanitization |
| MEDIUM | Hardcoded username in log path | `perf.ts` | Changed to `os.homedir()` |
| LOW | Unhandled JSON parse error | `bookmarks.service.ts` | Added try-catch wrapper |

---

## Architecture Summary

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
- Obsidian `![[image.jpg]]` syntax converted to standard markdown
- `convertObsidianImages()` resolves paths and uses `file://` protocol
- Path traversal protection prevents accessing files outside vault

### Caching
- Uses Raycast's Cache API (`@raycast/api`)
- Cache key: vault name
- Cache TTL: 30 minutes

### Performance Debugging
- `src/utils/perf.ts` - Toggle `PERF_ENABLED = true` to log metrics
- Logs written to `~/.obsidian-raycast-perf.log`

---

## Deployment Workflow (Windows)

```bash
# 1. Edit files locally

# 2. Build the extension
npm run build

# 3. For Windows Raycast beta: copy to raycast-x folder
# Build outputs to ~/.config/raycast/, but Raycast Windows reads from ~/.config/raycast-x/
```

**Windows Note**: `npm run build` outputs to `~/.config/raycast/extensions/`, but Raycast Windows beta reads from `~/.config/raycast-x/extensions/`. Copy the built extension to the correct location after building.

---

## Testing Checklist

- [x] Test with small vault (~100 notes) - 711BF Family vault
- [x] Test with large vault (1000+ notes) - Mine vault (1,276 notes)
- [x] Verify search responsiveness (< 100ms feel)
- [x] Verify memory usage stays reasonable (no heap overflow)
- [x] Test cache invalidation works correctly
- [x] Test content search still finds results
- [x] Test on Windows (bishop)
- [ ] Test on macOS (if available)

---

## Files Modified from Original

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
