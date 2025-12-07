#!/usr/bin/env node

/**
 * Create a PR to raycast/extensions using GitHub API
 * This avoids needing to clone the 24GB repository
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OWNER = "raycast";
const REPO = "extensions";
const FORK_OWNER = "josh-stephens";
const FORK_REPO = "raycast-extensions";
const BRANCH_NAME = "add-obsidian-multivault";
const EXTENSION_NAME = "obsidian-multivault";

// Files to exclude from upload
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /\.claude/,
  /CLAUDE\.md$/,
  /SESSION-SUMMARY\.md$/,
  /OPTIMIZATION_PLAN\.md$/,
  /DEVELOPMENT_STORY\.md$/,
  /media\//,
  /scripts\//,
  /\.tar\.gz$/,
  /^skip$/,
];

function ghApi(endpoint, method = "GET", data = null) {
  let cmd = `gh api ${endpoint}`;
  if (method !== "GET") {
    cmd += ` -X ${method}`;
  }
  if (data) {
    cmd += ` --input -`;
    return JSON.parse(
      execSync(cmd, { input: JSON.stringify(data), encoding: "utf8" })
    );
  }
  return JSON.parse(execSync(cmd, { encoding: "utf8" }));
}

function getFilesToUpload(dir, baseDir = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Check exclusions
    if (EXCLUDE_PATTERNS.some((p) => p.test(relativePath))) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...getFilesToUpload(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Only include regular files (not sockets, symlinks, etc.)
      files.push({
        path: `extensions/${EXTENSION_NAME}/${relativePath}`,
        localPath: fullPath,
      });
    }
  }

  return files;
}

async function main() {
  console.log("Creating PR to raycast/extensions...\n");

  // 1. Get the main branch SHA from the fork
  console.log("1. Getting main branch SHA...");
  const mainRef = ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/refs/heads/main`);
  const mainSha = mainRef.object.sha;
  console.log(`   Main SHA: ${mainSha}\n`);

  // 2. Get the base tree
  console.log("2. Getting base tree...");
  const commit = ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/commits/${mainSha}`);
  const baseTreeSha = commit.tree.sha;
  console.log(`   Base tree SHA: ${baseTreeSha}\n`);

  // 3. Create blobs for each file
  console.log("3. Creating blobs for extension files...");
  const extensionDir = path.dirname(__dirname); // Go up from scripts/
  const files = getFilesToUpload(extensionDir);
  console.log(`   Found ${files.length} files to upload\n`);

  const treeItems = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const content = fs.readFileSync(file.localPath);
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.localPath);

    process.stdout.write(`   [${i + 1}/${files.length}] ${file.path}...`);

    try {
      const blob = ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/blobs`, "POST", {
        content: isImage ? content.toString("base64") : content.toString("utf8"),
        encoding: isImage ? "base64" : "utf-8",
      });

      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });

      console.log(" ✓");
    } catch (error) {
      console.log(` ✗ ${error.message}`);
      throw error;
    }
  }

  // 4. Create tree
  console.log("\n4. Creating tree...");
  const tree = ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/trees`, "POST", {
    base_tree: baseTreeSha,
    tree: treeItems,
  });
  console.log(`   Tree SHA: ${tree.sha}\n`);

  // 5. Create commit
  console.log("5. Creating commit...");
  const newCommit = ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/commits`, "POST", {
    message: `Add Obsidian Multi-vault extension

A fork of obsidian-raycast with enhanced multi-vault support:
- Multi-vault management with custom display names, emojis, and colors
- Active vault concept with quick switching
- Lazy loading for large vaults (1000+ notes)
- Cross-vault search
- Windows/cross-platform support
- Image attachment rendering
- Performance optimizations (4200x faster tag extraction)

🤖 Generated with Claude Code`,
    tree: tree.sha,
    parents: [mainSha],
  });
  console.log(`   Commit SHA: ${newCommit.sha}\n`);

  // 6. Create/update branch
  console.log("6. Creating branch...");
  try {
    ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/refs/heads/${BRANCH_NAME}`, "PATCH", {
      sha: newCommit.sha,
      force: true,
    });
    console.log(`   Updated existing branch: ${BRANCH_NAME}\n`);
  } catch {
    ghApi(`repos/${FORK_OWNER}/${FORK_REPO}/git/refs`, "POST", {
      ref: `refs/heads/${BRANCH_NAME}`,
      sha: newCommit.sha,
    });
    console.log(`   Created new branch: ${BRANCH_NAME}\n`);
  }

  // 7. Create PR
  console.log("7. Creating pull request...");
  try {
    const pr = ghApi(`repos/${OWNER}/${REPO}/pulls`, "POST", {
      title: "Add Obsidian Multi-vault extension",
      head: `${FORK_OWNER}:${BRANCH_NAME}`,
      base: "main",
      body: `## Summary

This PR adds a new extension: **Obsidian Multi-vault** - A fork of the existing Obsidian extension with enhanced multi-vault support.

### New Features
- **Multi-Vault Management** - Customize display names, emojis, abbreviations, and colors for each vault
- **Active Vault** - Set a default vault and skip the vault picker (Cmd+Shift+V to switch)
- **Vault Favorites** - Mark vaults as favorites for priority sorting
- **Recent Notes Command** - View recently modified notes across all vaults with time filters
- **Cross-Vault Search** - Search notes across all vaults simultaneously
- **Vault Indicators** - Visual badges showing which vault each note belongs to

### Performance Improvements
- **Lazy Loading** - Notes load metadata only; content loaded on demand
- **Memory Optimized** - Handles vaults with 1000+ notes without crashing
- **Fast Tag Extraction** - Tags extracted from first 2KB of files (4200x faster)
- **Two-Phase Search** - Title/path search first, content search only when needed

### Cross-Platform
- Raycast Windows beta compatibility
- Cross-platform Obsidian config detection (Windows/macOS/Linux)

### Security
- Path traversal protection in note creation and image resolution
- Error handling improvements

## Author

- Raycast username: josh-stephens
- Extension category: Productivity
- Based on: obsidian-raycast (with significant enhancements)

## Checklist

- [x] I read the [extension guidelines](https://developers.raycast.com/basics/prepare-an-extension-for-store)
- [x] I tested the extension locally
- [x] I ran \`npm run lint --fix\`
- [x] I followed the [changelog format](https://developers.raycast.com/basics/prepare-an-extension-for-store#changelog)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`,
    });
    console.log(`   PR created: ${pr.html_url}\n`);
    console.log("Done! 🎉");
  } catch (error) {
    if (error.message.includes("already exists")) {
      console.log("   PR already exists, updating...\n");
      // Find and show existing PR
      const prs = ghApi(`repos/${OWNER}/${REPO}/pulls?head=${FORK_OWNER}:${BRANCH_NAME}`);
      if (prs.length > 0) {
        console.log(`   Existing PR: ${prs[0].html_url}\n`);
      }
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
