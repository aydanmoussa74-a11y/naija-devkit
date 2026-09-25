# Changelog

All notable changes to Naija DevKit.

## 0.0.1 — 2026-09-25

### Workspaces
- Files now live inside a workspace box, not one global pile.
- Existing files migrate into **Personal**. Nothing is deleted.
- **New workspace** starts empty. Explorer stays empty until you write or import.
- Workspace chips on the Workspace screen switch boxes without mixing files.

### Start writing
- Welcome and + no longer open the grey `github.io says` prompt.
- **Start writing** opens an `untitled` scratch buffer so you can type first and name later.
- New file / folder / workspace use an in-app name sheet (Cancel / Create).

### File tree
- Rows show a type tile (HTML, CSS, JS, MD, DIR, …), name, and a language pill.
- **⋮** on each row opens file ops. Long-press opens the same menu.
- Ops: open as Code / Markdown / Text, download, share, rename, new file, new folder, delete.

### Navigation
- In-app places push browser history (`#home`, `#editor`, …).
- Phone Back and the editor back button leave the current screen, not the whole PWA.
- Back from Home can still leave the site (one more Back at the root).
- Short haptic on place change when the phone supports it.
- Dock pages drag with the finger. Neighbour peeks in. Snap past ~35% width. No wrap, no editor swipe.

### Storage
- IndexedDB bumped to v3 with a `workspaces` store.
- Backup JSON now includes `workspaces`. Restore maps old files to Personal.

### Unchanged
- Offline-first. No tracking.
- Editor, preview iframe, Code / Markdown / Text pills, chip rail, dock.
- GitHub Pages path `/naija-devkit/`.
