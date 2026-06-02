# Specification for App
## Tech Stack

- React 18 + Vite
- Tailwind for layout/spacing only — all colors via CSS custom properties
- JSZip (npm) for ZIP export/import
- UUID via `crypto.randomUUID()`
- No other dependencies

---

## Themes

Two themes toggled via `:theme toggle` or `ctrl+t`. Persisted in `localStorage` key `theme` (`dark` or `light`). Applied as class `theme-dark` or `theme-light` on `<html>`.

All colors defined as CSS variables on each theme class. Tailwind must not hardcode any colors — use `var(--color-*)` everywhere.

**Dark: Terminal green on black**

```css
.theme-dark {
  --bg: #0a0a0a;
  --bg-subtle: #0d1a0d;
  --border: #003300;
  --border-focus: #00ff00;
  --text: #00ff00;
  --text-dim: #005500;
  --text-error: #ff0000;
  --highlight-bg: #0d1a0d;
  --highlight-border: #00ff00;
}
```

**Light: GitHub Light**

```css
.theme-light {
  --bg: #ffffff;
  --bg-subtle: #f6f8fa;
  --border: #d0d7de;
  --border-focus: #0969da;
  --text: #24292f;
  --text-dim: #57606a;
  --text-error: #cf222e;
  --highlight-bg: #ddf4ff;
  --highlight-border: #0969da;
}
```

Font: JetBrains Mono via Google Fonts, monospace fallback. Applied globally.
No rounded corners anywhere. All borders 1px solid.

---

## Data Model (IndexedDB)

DB name: `stickerdb`, version 1.

**Object store: `stickers`** (keyPath: `id`)

| Field | Type | Notes |
| --- | --- | --- |
| id | string | `crypto.randomUUID()` |
| name | string |  |
| packIds | string[] | multiEntry index — sticker can belong to multiple packs |
| tags | string[] |  |
| data | ArrayBuffer | raw image bytes — never store Blob directly |
| mimeType | string | `image/png`, `image/gif`, `image/webp` |
| createdAt | number | `Date.now()` |
| lastUsedAt | number | `Date.now()` |

Indexes on `stickers`:

- `lastUsedAt` (non-unique)
- `createdAt` (non-unique)
- `packIds` (non-unique, **multiEntry: true**)

**Object store: `packs`** (keyPath: `id`)

| Field | Type |
| --- | --- |
| id | string |
| name | string |
| createdAt | number |

### IndexedDB Implementation Rules

Follow these strictly:

- Always store image data as `ArrayBuffer`. When reading a `File` or `Blob`, call `await file.arrayBuffer()` before writing to IDB.
- When reading from IDB for display or clipboard, reconstruct: `new Blob([sticker.data], { type: sticker.mimeType })`.
- Call `navigator.storage.persist()` on app init (fire and forget).
- **Never** `await` non-IDB async operations inside an open IDB transaction. Pattern: do all async prep work (ZIP parsing, `arrayBuffer()` conversion, etc.) fully outside any transaction, then open a single transaction to write all results.
- For all reads that need sorting or filtering: use `store.getAll()` into memory, then sort/filter in JS. Do not use IDB cursors for sorted views.
- Wrap all IDB operations in try/catch. Surface errors to statusline as `E: <message>`.

On first open with empty DB: show centered hint `press a to add your first sticker` in `var(--text-dim)`.

---

## Layout

Full viewport, three regions, no page scroll:

```
+------------------+----------------------------------+
|                  |                                  |
|   PACK SIDEBAR   |        STICKER GRID              |
|    (180px)       |     (fills remaining width)      |
|                  |                                  |
+------------------+----------------------------------+
|              STATUSLINE (28px)                      |
+-----------------------------------------------------+
```

Hide scrollbars globally but keep scrollable (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`).

### Pack Sidebar (180px, fixed, left)

- Header: `PACKS` left + total sticker count right — e.g. `PACKS [42]`
- Each pack row: `> memes [12]` (active) or `memes [12]` (inactive)
- Count = number of stickers with this packId in their `packIds` array
- `(ungrouped) [4]` at bottom — stickers where `packIds.length === 0`
- No pack active = All view (default on open)
- Sidebar independently scrollable

### Sticker Grid (center, fills remaining width)

- Default: all stickers sorted by `lastUsedAt` desc
- Pack selected: filter to stickers containing that `packId`
- Each cell: 96×96px image (`object-fit: contain`) + name truncated to 12 chars + `..` in dim color below
- Focused cell: `var(--highlight-border)` border + `var(--highlight-bg)` background
- Hover: `transform: scale(1.15)`, z-index raised, tooltip showing full name + tags + pack names
- Animated GIFs: use `<img>` tag (not canvas)
- Empty state: centered `(no stickers)` in `var(--text-dim)`

### Statusline (full width, 28px, bottom)

Always visible. Single line. Monospace. Format varies by mode.

| Mode | Format |
| --- | --- |
| NORMAL | `NORMAL |
| SEARCH | `SEARCH |
| COMMAND | `COMMAND |
| CONFIRM | `CONFIRM |
| RENAME | `RENAME |
| TAGS | `TAGS |
| PACKASSIGN | `PACKASSIGN |
| UPLOAD | `UPLOAD |
| HELP | `HELP |

**Flash messages** (2s then revert): `yanked: pepe.gif`, `E: clipboard denied`, `E492: Not an editor command: foo`, `added: 3 stickers`, `imported: 12 stickers, 2 packs (1 skipped)`.

---

## Modes

One active mode at all times. In NORMAL mode, all keypresses captured at document level — `preventDefault` on all non-modifier keys so no browser shortcuts fire. Inputs only exist in the statusline, except the UPLOAD modal.

| Mode | Description |
| --- | --- |
| NORMAL | Default. Grid navigation and actions. |
| SEARCH | `/` pressed. Statusline has live search input. |
| COMMAND | `:` pressed. Statusline has command input with tab-completion. |
| CONFIRM | Awaiting `y/n` for destructive action. |
| RENAME | Statusline input for renaming focused sticker. |
| TAGS | Statusline input for editing tags of focused sticker. |
| PACKASSIGN | Statusline input for editing pack membership. |
| UPLOAD | Upload modal open. |
| HELP | Help modal open. |

---

## Keybindings

### NORMAL Mode

**Grid navigation**

| Key | Action |
| --- | --- |
| `h / j / k / l` | left / down / up / right |
| `gg` | first sticker (two `g` presses within 500ms) |
| `G` | last sticker |
| `0` | first in current row |
| `$` | last in current row |

**Pack navigation**

| Key | Action |
| --- | --- |
| `p` | next pack (All → pack1 → ... → last → All) |
| `P` | previous pack |
| `[n]p` | jump to nth pack (1-indexed); digit buffer clears after 1s |

**Sticker actions**

| Key | Action |
| --- | --- |
| `Enter` or `yy` | yank — copy to clipboard, update `lastUsedAt`, flash `yanked: name` |
| `a` | enter UPLOAD mode |
| `d` | enter CONFIRM mode: `delete "name"? [y/n]` |
| `r` | enter RENAME mode, prefill with current name |
| `t` | enter TAGS mode, prefill with current comma-separated tags |
| `m` | enter PACKASSIGN mode, prefill with current pack names |
| `f` | toggle tag `favourite`; flash `tagged: favourite` or `untagged: favourite` |

**Search & commands**

| Key | Action |
| --- | --- |
| `/` | enter SEARCH mode |
| `n` | next search match (wraps), moves grid focus |
| `N` | previous search match (wraps) |
| `:` | enter COMMAND mode |
| `?` | open HELP modal |
| `ctrl+t` | toggle theme |

### Mode-Specific Keys

| Mode | Key | Action |
| --- | --- | --- |
| SEARCH | `Esc` | clear search, back to NORMAL |
| SEARCH | `Enter` | lock filter, back to NORMAL |
| COMMAND | `Tab` | autocomplete first token |
| COMMAND | `Esc` | cancel |
| CONFIRM | `y` | confirm delete |
| CONFIRM | `n` / `Esc` | cancel |
| RENAME / TAGS / PACKASSIGN | `Enter` | save |
| RENAME / TAGS / PACKASSIGN | `Esc` | cancel |
| UPLOAD | `Ctrl+V` | paste image from clipboard into queue |
| UPLOAD | `Enter` | save all queued stickers |
| UPLOAD | `Esc` | close without saving |
| HELP | `q` / `Esc` | close modal |

---

## Command Palette

Entered via `:`. Tab-completes first token against known commands. `Esc` cancels. `Enter` executes. Unknown command flashes `E492: Not an editor command: <input>` in `var(--text-error)` for 2s.

### Pack Commands

| Command | Action |
| --- | --- |
| `:pack new <name>` | create pack |
| `:pack rename <name>` | rename currently viewed pack (error if in All view: `E: no pack selected`) |
| `:pack delete` | delete current pack; affected stickers have this packId removed from their `packIds` |
| `:pack move <name>` | add focused sticker to named pack (create if not exists) |

### Tag Commands

| Command | Action |
| --- | --- |
| `:tag add <tag>` | add tag to focused sticker |
| `:tag remove <tag>` | remove tag from focused sticker |
| `:tag rename <old> <new>` | rename tag globally across all stickers |

### Sort Commands

| Command | Action |
| --- | --- |
| `:sort recent` | sort by `lastUsedAt` desc (default) |
| `:sort added` | sort by `createdAt` desc |
| `:sort name` | sort by name asc |

### Export / Import

| Command | Action |
| --- | --- |
| `:export` | export full DB as ZIP |
| `:import` | open file picker for ZIP import |

### Theme

| Command | Action |
| --- | --- |
| `:theme toggle` | toggle dark/light |
| `:theme dark` | force dark |
| `:theme light` | force light |

### Help

| Command | Action |
| --- | --- |
| `:help` | open HELP modal (same as `?`) |

---

## Help Modal

Triggered by `?` in NORMAL mode or `:help` in COMMAND mode.

- Overlays the sticker grid (sidebar and statusline remain visible)
- Semi-transparent backdrop
- Two-column layout: normal mode keys on left, command palette on right
- Read-only, monospace, themed with CSS vars
- `q` or `Esc` closes

Content mirrors the keybinding and command tables in this spec.

---

## Editing Sticker Metadata

All editing via statusline inputs — no floating inputs or modals outside UPLOAD.

**RENAME mode (`r`)**

- Prefill with current sticker name
- `Enter`: validate non-empty, check name collision within same packs (auto-append `(2)`, `(3)` etc), save to IDB, return to NORMAL, flash `renamed: newname`
- `Esc`: cancel

**TAGS mode (`t`)**

- Prefill with current tags as comma-separated string
- `Enter`: parse (trim whitespace, remove empty), save tags array to IDB, return to NORMAL
- `Esc`: cancel

**PACKASSIGN mode (`m`)**

- Prefill with names of packs sticker currently belongs to, comma-separated
- `Tab`: complete current token against existing pack names
- `Enter`: parse names; find or create each pack; compute new `packIds` array; save to IDB; return to NORMAL
- Removing a pack name from the input removes that pack membership
- `Esc`: cancel

---

## Upload Modal

Triggered by `a`. Overlays the sticker grid only (sidebar and statusline remain visible). Semi-transparent backdrop (`rgba(0,0,0,0.7)` dark / `rgba(255,255,255,0.7)` light).

**Drop zone**

- Dashed border, centered text: `DROP STICKERS HERE`
- Accepts PNG, GIF, WebP, APNG
- Click to open multi-select file picker
- `Ctrl+V` while modal open: read image from clipboard, add to queue

**Upload queue**

Each pending sticker as a row:

- 48×48 thumbnail
- Editable name input (prefilled: filename minus extension)
- Tag input (comma-separated, placeholder `tags...`)
- Pack input (comma-separated, placeholder `packs...`, tab-completes against existing packs)
- `x` button to remove from queue

**Saving**

- `Enter` or `ADD ALL`: for each queued item — call `file.arrayBuffer()`, resolve all buffers first, then open a single IDB transaction to write everything. Create packs named in pack input if they don't exist.
- After save: close modal, refresh grid, flash `added: N stickers`
- `Esc`: close without saving

---

## Clipboard (Yank)

```jsx
const blob = new Blob([sticker.data], { type: sticker.mimeType });
await navigator.clipboard.write([new ClipboardItem({ [sticker.mimeType]: blob })]);
```

On success: update `lastUsedAt` in IDB, flash `yanked: <name>`.
On failure: construct object URL, create `<a download="name.ext">`, auto-click, revoke URL, flash `(no clipboard: downloading)`.

---

## Search

- Searches `name` + `tags`, case-insensitive substring
- Combines with active pack filter (AND)
- Real-time filtering while typing in SEARCH mode
- Result count shown in statusline
- `Esc`: clear search, return to NORMAL, keep pack filter
- `Enter`: lock in filter, return to NORMAL
- `n` / `N` in NORMAL: cycle focus through filtered results

---

## ZIP Export / Import

### Export (`:export`)

Output filename: `stickerdb-export-<YYYY-MM-DD>.zip`

```
stickerdb-export-2025-01-01.zip
├── manifest.json
└── stickers/
    ├── <id>.gif
    ├── <id>.png
    └── ...
```

`manifest.json` structure:

```json
{
  "version": 1,
  "exportedAt": 1234567890,
  "packs": [
    { "id": "...", "name": "...", "createdAt": 0 }
  ],
  "stickers": [
    {
      "id": "...",
      "name": "...",
      "packIds": ["..."],
      "tags": ["..."],
      "mimeType": "image/gif",
      "createdAt": 0,
      "lastUsedAt": 0,
      "file": "stickers/<id>.gif"
    }
  ]
}
```

Steps: `getAll()` stickers + packs from IDB → build manifest → add each sticker's `data` (ArrayBuffer) as binary to JSZip → generate blob → trigger browser download.
Flash: `exporting... done: N stickers`.

### Import (`:import`)

- Open file picker, `.zip` only
- Parse ZIP, read `manifest.json`
- For each pack: skip if `id` already in IDB
- For each sticker: skip if `id` already in IDB; read ArrayBuffer via `file.async('arraybuffer')`
- Resolve **all** `file.async()` calls before opening any IDB transaction
- Write all new packs + stickers in a single transaction
- Flash: `imported: N stickers, M packs (K skipped)`

---

## Edge Cases

- `gg`: two `g` keypresses within 500ms — use a keysequence buffer (array of recent keys + timestamps)
- `[n]p`: accumulate digit keypresses into a numeric buffer; execute on `p`; clear after 1s of no input
- Name collision on rename/import: append `(2)`, `(3)` etc, scoped to same packs
- Max display: sticker names 12 chars, pack names in sidebar 14 chars — truncate with `..`
- PACKASSIGN tab-complete: complete current comma-separated token, not the whole string
- `:pack delete` on a pack with stickers: remove `packId` from all affected stickers' `packIds` arrays in same transaction
- `(ungrouped)` is a virtual entry — never assign it an id or persist it to IDB
- Grid focus wraps at edges: `h` at col 0 → last col of previous row; `l` at last col → first col of next row
- If grid is empty and user presses any action key (`d`, `r`, `t`, `m`, `yy`): do nothing silently
- Animated GIFs play in grid via `<img>` tag
- Duplicate sticker name in same pack on upload: auto-append `(2)`, `(3)`