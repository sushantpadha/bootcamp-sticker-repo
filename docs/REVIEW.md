# REVIEW — SPEC.md ↔ Feature Docs Gap Audit

Scope: this audit compares `docs/SPEC.md` (product source-of-truth) against the
documented feature surface in `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`,
`docs/IDB.md`, `docs/MODES.md`, `docs/STATE.md`, and `docs/COMPLETED_TASKS.md`.
It does **not** look at the codebase yet — only doc-to-doc coverage.

Legend:
- **MISSING** — requirement in SPEC.md is absent from every feature doc.
- **PARTIAL** — touched on but key sub-requirements not documented.
- **OK** — fully and unambiguously covered.
- **REF-DRIFT** — feature docs reference a decision label / contract that has no
  matching definition.

---

## 1. Cross-cutting gaps (apply across many SPEC sections)

### 1.1 Flash message text catalog — MISSING
SPEC enumerates concrete flash strings the user must see:

- `yanked: <name>` (yank success)
- `E: clipboard denied` (and `(no clipboard: downloading)`)
- `E492: Not an editor command: <input>`
- `added: N stickers`
- `imported: N stickers, M packs (K skipped)`
- `renamed: <newname>`
- `tagged: favourite` / `untagged: favourite`
- `exporting... done: N stickers`
- `E: no pack selected`
- `E: <message>` (uniform error surface)

Only `E492`, `E: no pack selected`, and the generic `E: <message>` shape are
codified in feature docs (DOMAIN.md Command, IDB.md decision J,
COMPLETED_TASKS M7/M8). The exact success-flash strings (`yanked:`,
`renamed:`, `tagged:`/`untagged:`, `added:`, `imported:`, `exporting...`)
have no canonical home. STATE.md describes flash *scheduling* but not
flash *content*.

**Recommendation:** add a Flash-Catalog section (likely in STATE.md adjacent
to §Flash scheduling, or as a new appendix) enumerating the per-intent flash
strings with their error/success classification.

### 1.2 Tech-stack constraints — PARTIAL
SPEC §Tech Stack lists hard constraints: React 18, Vite, Tailwind
*layout/spacing only*, JSZip, `crypto.randomUUID()`, **no other dependencies**.

Feature docs imply most of these (JsZipCodec port, IdGenerator port,
Tailwind referenced in CLAUDE.md), but **no document codifies the
"no other dependencies" rule**, and **Tailwind-for-layout-only** is only
hinted at by COMPLETED_TASKS M11 ("no Tailwind hardcoded colors").

**Recommendation:** add a Constraints subsection in ARCHITECTURE.md naming
the allowed external deps and forbidding additions without a SPEC change.

### 1.3 REF-DRIFT — `decision E` referenced but never defined
STATE.md line 27 (`// ── focus by identity (see decision E) ──`) and
line 76 ("Focus is stored by id (decision E)") reference a labeled
decision that has **no heading** in STATE.md. The neighboring decisions
(A, D) do have headings. This is a documentation defect, not a SPEC gap,
but it should be fixed so the reference resolves.

**Recommendation:** add `## Decision E — focus-by-id (not by index)` in
STATE.md spelling out the invariant the engine relies on.

---

## 2. Per-section audit of SPEC.md

### 2.1 Themes — PARTIAL
| Item | Status | Where |
|---|---|---|
| Two themes, toggle via `:theme toggle` / `ctrl+t` | OK | SPEC + STATE.md (`setTheme` intent) + M11 |
| `localStorage` key `theme` persists | OK | STATE.md decision D |
| `theme-dark` / `theme-light` class on `<html>` | OK | STATE.md decision D, M11 |
| CSS variable palette values (exact hex) | **NOT REPLICATED — by design** (SPEC is source) |
| Tailwind: no hardcoded colors, only `var(--*)` | OK | M11 |
| JetBrains Mono via Google Fonts | OK | M11 |
| **No rounded corners; 1px solid borders** | OK | M11 |
| **`ctrl+t` as a keybinding (not just a command)** | **MISSING** in MODES.md NormalMode keybinding list — only `:theme toggle` is enumerated in DOMAIN/MODES |

### 2.2 Data Model (IndexedDB) — OK, with one omission
| Item | Status | Where |
|---|---|---|
| DB `stickerdb` v1; stores `stickers`/`packs`; indexes incl. `packIds` multiEntry | OK | IDB.md §schema |
| Sticker / Pack field shapes | OK | DOMAIN.md §Entities |
| ArrayBuffer-only persistence; ArrayBuffer↔Blob boundary | OK | IDB.md, DOMAIN.md |
| `navigator.storage.persist()` on init | OK | IDB.md, M9 |
| Tx discipline (no foreign awaits inside tx) | OK | IDB.md §Transaction discipline |
| `getAll()` → JS sort/filter, no cursors | OK | IDB.md |
| Try/catch all IDB, surface `E: <message>` | OK | IDB.md decision J |
| **Empty-DB centered hint `press a to add your first sticker` in `var(--text-dim)`** | **MISSING** — appears nowhere in feature docs (not in COMPLETED_TASKS M13 grid empty state either) |

### 2.3 Layout — multiple MISSING items
| Item | Status | Where |
|---|---|---|
| Three-region layout, sidebar 180px, statusline 28px, no page scroll | OK | M12 |
| Global scrollbar hiding (`scrollbar-width: none`, webkit rule) | OK | M12 (paraphrased) |
| **Sidebar header `PACKS [<total count>]`** | **MISSING** — Sidebar.tsx/PackRow.tsx mentioned in M13 but the header format is not |
| **Pack row visual format `> memes [12]` (active) vs `memes [12]` (inactive)** | **MISSING** — DOMAIN.md SidebarSelection only specifies `label()` + `count`, not the `>` active marker or `[count]` suffix shape |
| `(ungrouped)` row positioned at bottom | **PARTIAL** — DOMAIN.md says `(ungrouped)` exists as a SidebarSelection but ordering ("at bottom of sidebar") is not stated |
| Sidebar independently scrollable | **MISSING** |
| Sticker grid: 96×96 contain, name truncated to 12 chars + `..` in dim color | **PARTIAL** — M13 says "96×96 contain, name truncation" but the `..` suffix style and dim color are not codified |
| Focused cell: highlight border + bg | OK | M13 |
| **Hover behavior: `transform: scale(1.15)`, z-index raised, tooltip showing full name + tags + pack names** | **MISSING** entirely from feature docs |
| Animated GIF via `<img>` (not canvas) | OK | M13 |
| **Grid empty-state `(no stickers)` centered, `var(--text-dim)`** | **MISSING** — M13 doesn't mention the empty visible-list state |
| Statusline 28px, always visible, single line | OK | M12, M14 |
| Per-mode statusline content | OK | MODES.md decision C |

### 2.4 Modes — OK
All nine modes are listed in MODES.md with the substitution contract,
single-active invariant, and onEnter/onExit per-mode table. The "inputs
only in statusline except UPLOAD" rule lives in MODES.md decision I and
the document-level `preventDefault` rule in decision B. Fully covered.

### 2.5 Keybindings — PARTIAL (several keys absent)
Listed below: ✓ documented; ✗ missing from feature docs.

**NORMAL — Grid navigation**
- `h / j / k / l` — ✗ specific keys not enumerated in MODES.md; only "grid + pack navigation" mentioned in M5
- `gg` (two `g` within 500ms) — ✓ MODES.md decision H
- `G` (last sticker) — ✗ **MISSING** entirely
- `0` (first in current row) — ✗ **MISSING** entirely
- `$` (last in current row) — ✗ **MISSING** entirely
- Row-edge wrap (`h` at col 0 → last col of previous row; `l` at last col → first col of next row) — ✗ **MISSING** entirely

**NORMAL — Pack navigation**
- `p` / `P` (next/previous pack) — ✓ STATE.md `cycleSelection(±1)`
- `[n]p` digit buffer, 1s timeout — ✓ MODES.md decision H
- Wrap order `All → pack1 → … → last → All` — ✗ **MISSING** (cycle direction documented; wrap-through-All not stated)

**NORMAL — Sticker actions**
- `Enter` / `yy` (yank) — ✓ STATE.md `yankFocused` intent; MODES.md
- `a` (UPLOAD) — ✓
- `d` (CONFIRM delete) — ✓ MODES.md CONFIRM enter table
- `r` (RENAME) — ✓
- `t` (TAGS) — ✓
- `m` (PACKASSIGN) — ✓
- `f` (toggle `favourite` tag) — ✓ STATE.md `toggleFavourite` intent; **but** flash strings `tagged: favourite` / `untagged: favourite` are not specified (see §1.1)

**NORMAL — Search & commands**
- `/` (SEARCH), `:` (COMMAND), `?` (HELP) — ✓
- `n` (next search match, wraps) — ✗ **MISSING** — no intent in STATE.md catalog, no entry in MODES NormalMode behavior
- `N` (previous search match, wraps) — ✗ **MISSING**
- `ctrl+t` (toggle theme) — ✗ **MISSING** as a key binding (only `:theme toggle` command is doc'd)

**Mode-specific keys (SPEC §Keybindings, second table)**

| Key | Mode | Doc status |
|---|---|---|
| SEARCH `Esc` clear, back to NORMAL | OK (MODES.md onExit) |
| SEARCH `Enter` lock filter, back to NORMAL | **PARTIAL** — MODES.md says SEARCH onExit clears `statusInput`; "lock the filter" semantics (i.e. `search` persists in AppState while statusInput is cleared) implied but not explicit |
| COMMAND `Tab` autocomplete first token | OK (MODES decision C; M7 trie resolver) |
| COMMAND `Esc` cancel | OK |
| CONFIRM `y`/`n`/`Esc` | OK (MODES.md table) |
| RENAME/TAGS/PACKASSIGN `Enter` save / `Esc` cancel | OK |
| UPLOAD `Ctrl+V` paste image | OK (M15) |
| UPLOAD `Enter` save all | OK (M15) |
| UPLOAD `Esc` close without saving | OK |
| HELP `q` / `Esc` close | OK |

### 2.6 Command Palette — mostly OK, gaps on text
| Command | Status |
|---|---|
| Trie resolver, longest-path match, E492 on miss | OK (DOMAIN.md Command, M7) |
| `:pack new <name>` | OK (path in DOMAIN.md example) |
| `:pack rename <name>` + error `E: no pack selected` outside Pack selection | OK (DOMAIN.md, M7) |
| `:pack delete` removes packId from affected stickers in same tx | OK (M8) |
| `:pack move <name>` add focused sticker to (create-if-missing) pack | **PARTIAL** — M8 mentions pack create/rename/delete/move services but the create-if-missing semantic for `move` is not explicit |
| `:tag add <tag>` / `:tag remove <tag>` | **PARTIAL** — referenced via `tagCommands.ts` in ARCHITECTURE and M7; per-command semantics not spelled out |
| **`:tag rename <old> <new>` — global across all stickers** | **PARTIAL** — listed as a tagCommand only; the "global rename across all stickers in one tx" semantic is not codified anywhere |
| `:sort recent` / `:sort added` / `:sort name` | OK (DOMAIN.md StickerSort) |
| `:export` | OK (M8 exportService) |
| `:import` | OK (M8 importService) |
| `:theme toggle` / `:theme dark` / `:theme light` | **PARTIAL** — themeCommands.ts referenced; per-arg behavior not enumerated |
| `:help` | OK |

### 2.7 Help Modal — PARTIAL
| Item | Status |
|---|---|
| Triggered by `?` (NORMAL) or `:help` (COMMAND) | OK |
| Exclusive mode, renders via `overlay()` | OK (MODES.md decision B; M16) |
| Sidebar + statusline remain visible | OK (M16 implies via "renders only as HELP overlay") |
| **Semi-transparent backdrop** | **MISSING** specific backdrop styling |
| **Two-column layout: NORMAL keys on left, command palette on right** | **MISSING** — M16 says "two-column keys/commands" without specifying which column gets which |
| Read-only, monospace, themed via CSS vars | OK (M16) |
| `q` / `Esc` close | OK |

### 2.8 Editing Sticker Metadata — PARTIAL
| Item | Status |
|---|---|
| RENAME prefill with current name | OK (MODES.md per-mode table) |
| RENAME `Enter` validates non-empty | **MISSING** explicitly — DOMAIN.md decision F handles collision but the non-empty precheck is not documented |
| RENAME collision → append `(2)`, `(3)` scoped to same packs | OK (DOMAIN.md decision F) |
| RENAME flash `renamed: <newname>` | **MISSING** (see §1.1) |
| TAGS prefill comma-separated | OK |
| **TAGS parsing: trim whitespace, remove empty entries** | **MISSING** explicit rule |
| TAGS save as `string[]` | OK (DOMAIN.md Sticker.tags) |
| PACKASSIGN prefill with current pack names, comma-separated | OK (MODES.md per-mode table) |
| PACKASSIGN `Tab` completes the **current comma-separated token** (not the whole string) | **MISSING** — MODES.md decision C just says "tab-completes token" without the SPEC §Edge Cases clarification |
| PACKASSIGN saves: find-or-create each pack, compute new `packIds` | **PARTIAL** — M8 packService mentions move/create but the PACKASSIGN diff-and-resolve algorithm (i.e. removed names → membership drop) is not documented |
| PACKASSIGN removing a pack name from input removes membership | **MISSING** explicit rule |

### 2.9 Upload Modal — PARTIAL
| Item | Status |
|---|---|
| Triggered by `a` | OK |
| Exclusive mode rendering as overlay; sidebar + statusline remain | OK (MODES.md, M15) |
| **Semi-transparent backdrop with theme-specific rgba** (`rgba(0,0,0,0.7)` dark / `rgba(255,255,255,0.7)` light) | **MISSING** |
| **Drop zone visuals: dashed border, centered text `DROP STICKERS HERE`** | **MISSING** |
| Accepts PNG, GIF, WebP, APNG (APNG stored as `image/png`) | OK (DOMAIN.md decision G) |
| Click drop zone → multi-select file picker | OK (IDB.md FilePickerPort.pickImages) |
| `Ctrl+V` reads clipboard image into queue | OK (M15; DOMAIN.md ClipboardImageCandidate) |
| Queue row: 48×48 thumbnail | OK (DOMAIN.md StickerCandidate.thumbnailUrl 48×48) |
| Queue row: name input prefilled with filename-minus-extension | **PARTIAL** — STATE.md `QueuedSticker.name` prefilled from `candidate.defaultName`; the "filename minus extension" derivation for FileCandidate is not codified |
| Queue row: tag input, placeholder `tags...` | **MISSING** placeholder text |
| Queue row: pack input, placeholder `packs...`, tab-completes against existing packs | **MISSING** placeholder + per-row tab-complete behavior (M15 doesn't address it) |
| Queue row: `x` button to remove | **MISSING** — STATE.md `removeQueueRow` intent exists; the row UI affordance is not documented |
| **`ADD ALL` button as alternative to `Enter`** | **MISSING** — only the `Enter` save path is mentioned |
| Save: resolve all `arrayBuffer()` first, then single tx (incl. pack creation) | OK (IDB.md, M15) |
| After save: close modal, refresh grid, flash `added: N stickers` | **PARTIAL** — flash text missing (§1.1); "refresh grid" is implicit via snapshot |
| `Esc` close without saving; thumbnails revoked | OK (MODES.md UPLOAD onExit) |

### 2.10 Clipboard (Yank) — PARTIAL
| Item | Status |
|---|---|
| Construct `Blob` from ArrayBuffer + mimeType, write via `ClipboardItem` | OK (IDB.md ClipboardPort.write) |
| Update `lastUsedAt` on success | OK (M8 yankService) |
| Success flash `yanked: <name>` | **MISSING** (§1.1) |
| **Download fallback: build object URL, create `<a download="name.ext">`, auto-click, revoke URL** | **MISSING** — M8 says "download fallback" but the exact mechanism (anchor + revoke) is not documented |
| **Failure flash `(no clipboard: downloading)`** | **MISSING** |
| Extension picked from mimeType via decision-G map | OK (DOMAIN.md decision G) |

### 2.11 Search — PARTIAL
| Item | Status |
|---|---|
| Substring match on name + each tag, case-insensitive | OK (DOMAIN.md SearchPredicate) |
| AND-composed with active SidebarSelection | OK (STATE.md derived table) |
| Real-time filtering while typing | **PARTIAL** — SEARCH mode's `setSearch` intent implies live update; the "live" requirement is not explicit |
| Match count shown in statusline | OK (MODES.md decision C) |
| `Esc` clears search, returns to NORMAL, keeps pack filter | **PARTIAL** — MODES.md onExit clears `statusInput`, not `search`; the SPEC says `Esc` should also clear the `search` string while keeping `selection`. This needs explicit documentation of which exit-paths reset `search` vs only `statusInput` |
| `Enter` locks filter, returns to NORMAL (search persists in AppState) | **PARTIAL** — implicit; not explicit |
| `n` / `N` in NORMAL: cycle focus through filtered results, wraps | **MISSING** entirely (see §2.5) |

### 2.12 ZIP Export / Import — multiple MISSING
| Item | Status |
|---|---|
| **Export filename `stickerdb-export-<YYYY-MM-DD>.zip`** | **MISSING** |
| **ZIP layout**: `manifest.json` at root + `stickers/<id>.<ext>` files | **MISSING** entirely — ZipCodecPort is mentioned in IDB.md ports but no schema for the archive contents is documented |
| **`manifest.json` schema** (version, exportedAt, packs[], stickers[] with `file` pointer) | **MISSING** |
| Export pipeline: `getAll` → build manifest → add binaries → JSZip blob → download | **PARTIAL** — M8 mentions the service but no schema |
| Export flash `exporting... done: N stickers` | **MISSING** (§1.1) |
| Import: `.zip`-only picker | OK (IDB.md FilePickerPort.pickZip) |
| Import parse: read `manifest.json`, materialize buffers | **PARTIAL** — M8 mentions "single tx after all bytes resolved" (IDB.md rule) but the manifest schema is undocumented |
| **Conflict resolution on import: skip pack by existing `id`; skip sticker by existing `id`** | **MISSING** entirely — no document says imports key on `id` for dedup |
| Single transaction for all new packs + stickers | OK (IDB.md) |
| Flash `imported: N stickers, M packs (K skipped)` | **PARTIAL** — example string appears in MODES/STATE flash discussions but not as a normative output |

### 2.13 Edge Cases (SPEC §Edge Cases) — mixed
| Edge case | Status |
|---|---|
| `gg` two-keys within 500ms via keysequence buffer | OK (MODES.md decision H) |
| `[n]p` digit buffer, 1s clear | OK (MODES.md decision H) |
| Name collision append `(2)`, `(3)`, per-pack scope | OK (DOMAIN.md decision F) |
| **Pack name max display 14 chars, truncate with `..`** | **MISSING** entirely (sticker-name 12-char truncation noted in M13; pack-name truncation absent) |
| PACKASSIGN tab-complete: token-scoped, not whole-buffer | **MISSING** (see §2.8) |
| `:pack delete` removes packId from all affected stickers in same tx | OK (M8 packService) |
| `(ungrouped)` is virtual; never persisted with an id | OK (DOMAIN.md SidebarSelection, ARCHITECTURE LSP §3) |
| **Grid focus wrap at row edges (`h` at col 0, `l` at last col)** | **MISSING** — STATE.md `moveFocus(dir)` intent exists; the wrap semantics are not specified |
| **Empty grid + action key (`d`, `r`, `t`, `m`, `yy`) = silent no-op** | **MISSING** — STATE.md doesn't say what these intents do when `focusId === null` |
| Animated GIFs via `<img>` | OK (M13) |
| Duplicate sticker name in same pack on upload → append `(2)`, `(3)` | OK (DOMAIN.md decision F) |

---

## 3. Summary table — net gaps to close before implementation

Grouped by where the fix most likely belongs.

### Add to STATE.md
- §Flash catalog: enumerate exact flash strings per intent (§1.1).
- §Decision E heading defining focus-by-id invariant (§1.3).
- Specify which `onExit` paths reset `search` vs only `statusInput` (§2.11).
- Empty-grid behavior of action intents (`deleteFocused`, `yankFocused`,
  `renameFocused`, `setTags`, `assignPacks`, `toggleFavourite`) when
  `focusId === null` — must be silent no-op (§2.13).

### Add to MODES.md
- NormalMode keybinding table: `h/j/k/l`, `G`, `0`, `$`, `n`, `N`, `ctrl+t`,
  pack-cycle wrap order (§2.5).
- Grid focus wrap behavior at row edges (`h` at col 0, `l` at last col) (§2.13).
- TAGS parsing rule (trim + remove empties) (§2.8).
- PACKASSIGN tab-complete is current-token-scoped (§2.8).
- PACKASSIGN diff semantics: removed names drop membership (§2.8).
- SEARCH `Enter` vs `Esc` divergence in `search` state retention (§2.11).
- HELP modal column assignment: NORMAL keys left / commands right (§2.7).

### Add to DOMAIN.md
- `:pack move <name>` create-if-missing semantic (§2.6).
- `:tag rename <old> <new>` global semantic + atomicity within one tx (§2.6).
- `:theme toggle|dark|light` per-arg semantics (§2.6).
- RENAME validation: non-empty precondition before collision resolution (§2.8).

### Add to IDB.md
- ZIP archive layout (manifest.json + `stickers/<id>.<ext>`) (§2.12).
- `manifest.json` schema (version, exportedAt, packs[], stickers[].file) (§2.12).
- Export filename format `stickerdb-export-<YYYY-MM-DD>.zip` (§2.12).
- Import dedup keys (pack by `id`, sticker by `id`) (§2.12).
- Yank download fallback mechanism (object URL + anchor + revoke) (§2.10) — may
  alternatively belong in COMPLETED_TASKS M8.

### Add to ARCHITECTURE.md
- Tech-stack constraints + "no other dependencies" rule (§1.2).
- Visual constants: backdrop rgba per theme, drop-zone border style,
  hover-scale 1.15 + tooltip, `>` active pack marker, `(ungrouped)` row
  position, `[count]` suffix format, queue row placeholders (`tags...`,
  `packs...`), `ADD ALL` button, queue-row `x` remove affordance, empty-DB
  centered hint, empty-grid `(no stickers)` message, pack name 14-char
  truncation, `..` truncation suffix style for sticker names (§2.1, §2.3,
  §2.7, §2.9).
  *Alternative*: split visual specifics into a new `docs/VISUALS.md` and
  reference it from COMPLETED_TASKS M11–M16.

### Add to COMPLETED_TASKS.md (acceptance criteria refinement)
- M13: grid empty state, hover transform + tooltip, name `..` truncation
  style, dim-color name caption (§2.3).
- M11/M12: empty-DB welcome hint (§2.2).
- M13: sidebar header `PACKS [N]`, active row `>` marker, ungrouped at
  bottom, sidebar independent scroll (§2.3).
- M15: drop-zone text + dashed border, backdrop rgba, queue-row
  placeholders + `x` remove + `ADD ALL` button (§2.9).
- M16: help-modal column assignment + backdrop (§2.7).
- M8: yank download fallback specifics (§2.10).
- M8: export filename + manifest schema + import dedup (§2.12).

---

## 4. Items where the SPEC is the *only* authoritative source — leave as-is

These are intentionally not duplicated into feature docs because SPEC.md
already holds them and duplicating would risk drift:

- Exact theme CSS variable hex values.
- Exact font choice (JetBrains Mono).
- Exact pixel sizes (180px sidebar, 28px statusline, 96×96 cell, 48×48
  thumbnail) — though these *are* mentioned in COMPLETED_TASKS, the
  primary source remains SPEC.

If a stronger guarantee is desired ("these values must never drift from
SPEC"), the right move is a `themeVars.css`/layout-tokens fixture that
parses SPEC, not duplicating the values into prose.
