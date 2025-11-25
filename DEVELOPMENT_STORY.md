# Development Story: Obsidian Multivault for Raycast

> A narrative of how this extension was developed, the problems we encountered, and how we solved them.

## The Beginning

This project started as a fork of the excellent [obsidian-raycast](https://github.com/KevinBatdorf/obsidian-raycast) extension, originally created by Marc Julian Schwarz and maintained by Kevin Batdorf. The goal was to enhance multi-vault support and make the extension work seamlessly on Windows.

## The Team

**Josh Stephens** - Human developer, Obsidian power user with multiple vaults across devices

**Claude (Opus 4.5)** - AI pair programmer, providing code analysis, debugging, and implementation

## Development Environment

- **Primary Development Machine**: Linux server "skippy"
- **Testing Target**: Windows 11 machine "bishop" (accessed via Tailscale SSH)
- **Version Control**: Git
- **Package Manager**: npm

The development workflow involved editing files on skippy, then deploying to bishop via SCP for testing in Raycast.

---

## Session 1: Getting It Running on Windows

### Problem: Extension Won't Load

When we first tried to run the extension on bishop, Raycast showed "Missing executable. You might need to build the extension."

**Investigation:**
- Found a stale dev server process (PID 648) from previous attempts
- Discovered that `ray develop` was deploying to the wrong folder

**Root Cause Discovery:**
Raycast on Windows (beta) uses a different configuration path than macOS:
- macOS: `~/.config/raycast/extensions/`
- Windows: `~/.config/raycast-x/extensions/`

**Solution:**
Created a deployment workflow:
1. Build with `npm run build`
2. Copy from `~/.config/raycast/extensions/` to `~/.config/raycast-x/extensions/`

### Problem: "No Vaults Found"

After getting the extension to load, it couldn't find any vaults even though paths were configured.

**Investigation:**
User had configured vault paths with quotes: `"C:\Users\josh\Documents\Mine","C:\Users\josh\Documents\711BF Family"`

**Root Cause:**
The `parseVaults()` function split on commas but didn't handle quoted paths or strip quotes.

**Solution:**
Rewrote `parseVaults()` with a state machine that:
- Tracks whether we're inside quotes
- Handles both single and double quotes
- Strips quotes from parsed paths
- Validates paths exist before adding to vault list

Also discovered `loadObsidianJson()` used macOS-only paths. Added `getObsidianConfigPath()` to support:
- macOS: `~/Library/Application Support/obsidian/obsidian.json`
- Windows: `%APPDATA%/obsidian/obsidian.json`
- Linux: `~/.config/obsidian/obsidian.json`

---

## Session 2: The Memory Crisis

### Problem: "JS Heap Out of Memory"

With vaults now detected, we tried the "Random Note" command. Raycast crashed with:
```
Error: Worker terminated due to reaching memory limit: JS heap out of memory
```

**Investigation:**
- User's "Mine" vault: 1,276 notes (~12MB of markdown)
- The `loadNotes()` function was reading the ENTIRE CONTENT of every note into memory at startup

**Root Cause:**
```typescript
// Old code - loaded ALL content upfront
for (const filePath of filePaths) {
  const content = fs.readFileSync(filePath, "utf8");  // 12MB loaded here!
  notes.push({ title, path, content, ... });
}
```

**Solution: Lazy Loading Architecture**

1. **Metadata-only initial load:**
```typescript
const note: Note = {
  title,
  path: filePath,
  lastModified: fs.statSync(filePath).mtime,
  tags: getTagsFromFileHead(filePath),  // Only read first 2KB
  content: "",  // Empty! Loaded on demand
  bookmarked: ...,
};
```

2. **New helper functions:**
- `getNoteContent(note, filter, vault)` - Loads content on demand
- `ensureNoteContent(note)` - Mutates note to have content loaded
- `getTagsFromFileHead(path)` - Reads only first 2KB for YAML tags

3. **Updated all consumers:**
- `NoteQuickLook.tsx` - Uses `getNoteContent(note, true, vault)`
- `NoteListItem.tsx` - Uses `useMemo` with `getNoteContent`
- `actions.tsx` - Updated copy/paste actions
- `search.tsx` - Updated content search
- `yaml.tsx` - Updated tag extraction

**Result:** Extension now loads instantly, even with 1,276 notes!

---

## Session 3: Image Rendering

### Problem: Images Don't Display

Notes with embedded images like `![[screenshot.png]]` showed broken links or nothing.

**Root Cause:**
Obsidian uses wiki-link syntax for images, but Raycast's markdown renderer expects standard markdown: `![alt](path)`

**Solution:**

1. **Added regex for Obsidian image embeds:**
```typescript
const OBSIDIAN_IMAGE_EMBED_REGEX = /!\[\[([^\]|]+(?:\.(jpg|jpeg|png|gif|webp|svg|bmp)))(?:\|([^\]]*))?\]\]/gi;
```

2. **Created image path resolver:**
```typescript
function resolveImagePath(imageName: string, vault: Vault, notePath?: string): string | null {
  // Check: direct path, attachment folder, vault root, same folder as note, recursive search
}
```

3. **Convert to standard markdown:**
```typescript
function convertObsidianImages(content: string, vault: Vault, notePath?: string): string {
  return content.replace(OBSIDIAN_IMAGE_EMBED_REGEX, (match, imagePath, _ext, altText) => {
    const resolvedPath = resolveImagePath(imagePath, vault, notePath);
    if (resolvedPath) {
      return `![${altText || imagePath}](file://${resolvedPath})`;
    }
    return `[Image not found: ${imagePath}]`;
  });
}
```

---

## Session 4: Excalidraw Files

### Problem: Random Note Shows Garbage

User hit a random note and saw raw compressed JSON data - an Excalidraw drawing file.

**Root Cause:**
Excalidraw files are `.md` files with special frontmatter and compressed drawing data. The extension was showing the raw content.

**Solution:**

1. **Detect Excalidraw content:**
```typescript
function isExcalidrawContent(content: string): boolean {
  return content.includes("excalidraw-plugin:") || content.includes("# Excalidraw Data");
}
```

2. **Show friendly message with embedded images:**
```typescript
function formatExcalidrawContent(content: string, vault?: Vault, notePath?: string): string {
  let result = "# 🎨 Excalidraw Drawing\n\n";
  result += "*This is an Excalidraw drawing file. Open in Obsidian to view and edit.*\n\n";

  // Extract and display any embedded images
  const embeddedFiles = getExcalidrawEmbeddedFiles(content);
  // ... render images

  return result;
}
```

---

## Session 5: Performance Research

With the extension working, we noticed search was slow on large vaults. We researched [Omnisearch](https://github.com/scambier/obsidian-omnisearch) to learn optimization techniques.

### Key Findings from Omnisearch:

1. **MiniSearch library** - Uses BM25 algorithm for relevance ranking
2. **IndexedDB caching** - Persists search index to disk
3. **Lazy reindexing** - Batch updates when search opens
4. **Field boosting** - Weights for title, headings, content
5. **Chunked processing** - 500-document batches

### Optimization Plan Created:

**Phase 1 (Quick Wins):**
- Search debouncing (150ms)
- Pre-built Fuse.js index in cache
- Title-first search (content as fallback)
- Longer cache TTL (30 min vs 5 min)

**Phase 2 (Structural):**
- Two-phase search
- Progressive results
- Smarter field weights
- Content excerpts only

**Phase 3 (Advanced):**
- Consider MiniSearch migration
- Background index updates

---

## Lessons Learned

1. **Platform differences matter** - Windows paths, config locations, and behaviors differ significantly from macOS

2. **Memory is precious** - Raycast extensions run in sandboxed workers with strict memory limits. Lazy loading is essential for large datasets.

3. **User input is messy** - Always handle quoted paths, extra whitespace, and various separator styles

4. **Research existing solutions** - Omnisearch's architecture provided valuable insights for optimization

5. **AI pair programming works** - Claude helped debug issues, research solutions, and implement fixes efficiently

---

---

## Session 6: Code Review and Assessment

### Comprehensive Code Review

Performed thorough review of all optimizations to assess readiness for security audit.

**Findings:**

1. **Phase 1 fully complete** - All quick wins implemented and working
2. **Phase 2 mostly complete** - Lazy content loading works, title-first search works
3. **Bug found in `filterNotesFuzzy()`** - When `byContent=true`, it adds "content" to Fuse.js keys, but notes don't have content loaded (lazy loading). This would cause empty matches. Needs fix before production.
4. **`ShowMentioningNotesAction` is expensive** - Scans all notes for mentions by loading all content. Works but slow on large vaults.

**Remaining before security audit:**
- Fix `filterNotesFuzzy()` content search bug (high priority)
- Add field weights to Fuse.js (title > path > content) (medium priority)
- Content excerpt indexing (low priority, deferred)

---

## What's Next

See [OPTIMIZATION_PLAN.md](./OPTIMIZATION_PLAN.md) for the full roadmap including:
- Fix remaining bugs
- Security audit
- Publication to GitHub and Raycast Store

---

## Timeline

| Date | Milestone |
|------|-----------|
| 2025-11-25 | Initial fork and Windows fixes |
| 2025-11-25 | Lazy loading implementation |
| 2025-11-25 | Image rendering support |
| 2025-11-25 | Excalidraw handling |
| 2025-11-25 | Performance research |
| 2025-11-25 | Phase 1 optimizations complete |
| 2025-11-25 | Phase 2 assessment - mostly complete |
| TBD | Fix remaining bugs |
| TBD | Security audit |
| TBD | Public release |
