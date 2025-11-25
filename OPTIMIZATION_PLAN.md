# Project Roadmap & Optimization Plan

> Generated: 2025-11-25
> Status: In Progress

## Project Goals

1. Fix critical bugs preventing Windows usage
2. Optimize search performance for large vaults
3. Publish as open source with full documentation
4. Run security audit before release

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
- [ ] **1.2 Pre-build Fuse Index on Cache Creation** - SKIPPED (search already fast)
- [x] **1.3 Title-First Search** - Only searches content when <20 title matches
- [x] **1.4 Increase Cache TTL** - 30 minutes (was 5 minutes)
- [x] **1.5 Fix tagsForNotes() bottleneck** - Was reading ALL files twice (1593ms → 0.38ms, 4200x faster!)
- [x] **1.6 Reduce MAX_RENDERED_NOTES** - 1000 → 100 items
- [x] **1.7 Add perf.ts utility** - Toggle PERF_ENABLED for debugging

### Phase 2: Structural Improvements
- [ ] **2.1 Lazy Content Loading** - Two-phase search: title filter → content refinement
- [ ] **2.2 Progressive Results** - Show title matches immediately, content in background
- [ ] **2.3 Smarter Fuse.js Config** - Field weights, stricter threshold
- [ ] **2.4 Index Content Excerpt** - First 5000 chars only

### Phase 3: Advanced Optimizations (Optional)
- [ ] **3.1 Switch to MiniSearch** - BM25 algorithm, better relevance
- [ ] **3.2 Background Index Updates** - Incremental updates vs full rebuild

### Phase 4: Publication
- [ ] Run security audit
- [ ] Fix any security issues found
- [ ] Final testing on Windows and macOS
- [ ] Publish to GitHub
- [ ] Submit to Raycast Store (optional)

---

## Current Architecture Issues

### 1. Initial Load Time
- `getNotesFromCache()` loads ALL notes synchronously on vault selection
- Cache only stores metadata (no pre-built search index)
- 5-minute cache TTL means frequent re-reads from disk

### 2. Search Performance
- `filterNotes()` with `byContent=true` calls `getNoteContent()` for EVERY note on EVERY keystroke
- Fuse.js re-indexes the entire collection on each search
- No debouncing on search input (only `throttle={true}` on List)

### 3. Content Search
- Loads full file content from disk during search filtering
- No pre-built search index - linear scan of all content

---

## Omnisearch Research

Research from https://github.com/scambier/obsidian-omnisearch

### Key Techniques Used by Omnisearch

1. **MiniSearch Library** - Full-text search with BM25 algorithm
2. **IndexedDB Caching** - Serialized search index persisted to disk
3. **Lazy Reindexing** - Files flagged for update, batch processed when search opens
4. **Chunked Processing** - 500-document batches to prevent memory spikes
5. **Field Boosting** - Configurable weights for basename, aliases, headings, content
6. **Recency Boost** - Exponential decay based on modification time
7. **Result Limiting** - Top 50 results after scoring

### Comparison Table

| Technique | Omnisearch | Our Current | Recommendation |
|-----------|------------|-------------|----------------|
| **Search Library** | MiniSearch (BM25) | Fuse.js (fuzzy) | Keep Fuse.js but optimize |
| **Index Caching** | IndexedDB persistence | JSON cache (metadata only) | Add search index to cache |
| **Lazy Indexing** | Deferred until search opened | None | Pre-build on cache creation |
| **Chunked Processing** | 500-doc batches | All at once | Add chunking |
| **Result Limit** | Top 50 results | 1000 max rendered | Keep similar |
| **Field Boosting** | Configurable weights | Equal weights | Add title boost |
| **Debouncing** | UI layer | Only List throttle | Add explicit debounce |

---

## Technical Implementation Details

### Phase 1.1: Search Debouncing

**File:** `src/components/NoteList/NoteList.tsx`

```typescript
import { useDebouncedValue } from "@raycast/utils";

// In component:
const [searchText, setSearchText] = useState("");
const debouncedSearchText = useDebouncedValue(searchText, 150);
const list = useMemo(
  () => searchFunction(notes ?? [], debouncedSearchText, pref.searchContent),
  [notes, debouncedSearchText]
);
```

### Phase 1.2: Pre-built Fuse Index

**File:** `src/api/cache/cache.service.ts`

```typescript
import Fuse from "fuse.js";

interface CachedData {
  lastCached: number;
  notes: Note[];
  fuseIndex?: Fuse.FuseIndex<Note>;  // Serialized index
}

export function cacheNotesFor(vault: Vault) {
  const notes = loadNotes(vault);

  // Pre-build Fuse index
  const fuse = new Fuse(notes, {
    keys: ["title", "path"],
    threshold: 0.3,
    ignoreLocation: true,
  });
  const fuseIndex = fuse.getIndex();

  cache.set(vault.name, JSON.stringify({
    lastCached: Date.now(),
    notes: notes,
    fuseIndex: fuseIndex.toJSON()
  }));

  return { notes, fuseIndex };
}
```

### Phase 1.3: Title-First Search

**File:** `src/utils/search.tsx`

```typescript
export function filterNotes(notes: Note[], input: string, byContent: boolean) {
  if (input.length === 0) return notes;

  input = input.toLowerCase();

  // Always do fast title/path filter first
  let results = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(input) ||
      note.path.toLowerCase().includes(input)
  );

  // Only search content if enabled AND title search found few results
  if (byContent && results.length < 10) {
    const contentMatches = notes.filter(
      (note) =>
        !results.includes(note) &&
        getNoteContent(note, false).toLowerCase().includes(input)
    );
    results = [...results, ...contentMatches];
  }

  return results;
}
```

### Phase 1.4: Increase Cache TTL

**File:** `src/api/cache/cache.service.ts`

```typescript
// Change from 5 minutes to 30 minutes
const CACHE_TTL_MS = 1000 * 60 * 30;

export function getNotesFromCache(vault: Vault) {
  if (cacheExistForVault(vault)) {
    const data = JSON.parse(cache.get(vault.name) ?? "{}");
    if (data.notes?.length > 0 && data.lastCached > Date.now() - CACHE_TTL_MS) {
      // ... use cache
    }
  }
  // ... rebuild cache
}
```

---

## Files to Modify

### Phase 1
- `src/components/NoteList/NoteList.tsx` - Debouncing
- `src/api/cache/cache.service.ts` - Index caching, TTL
- `src/utils/search.tsx` - Title-first search logic
- `package.json` - Add @raycast/utils if not present

### Phase 2
- `src/utils/hooks.tsx` - Progressive loading
- `src/api/vault/vault.service.ts` - Content excerpts

### Phase 3
- `package.json` - Add minisearch dependency
- New file: `src/api/search/search-engine.ts`

---

## Testing Checklist

- [ ] Test with small vault (~100 notes)
- [ ] Test with large vault (1000+ notes)
- [ ] Verify search responsiveness (< 100ms feel)
- [ ] Verify memory usage stays reasonable
- [ ] Test cache invalidation works correctly
- [ ] Test content search still finds results
- [ ] Test on Windows (bishop)
- [ ] Test on macOS (if available)

---

## Notes

- Raycast's `@raycast/utils` package has `useDebouncedValue` hook
- Fuse.js index is serializable via `getIndex().toJSON()` and `Fuse.parseIndex()`
- MiniSearch also supports index serialization
- Consider adding a "Rebuild Index" action for users
