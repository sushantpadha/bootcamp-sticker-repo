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

---

# Part 2 — SPEC.md ↔ Codebase Implementation Gap Audit

Scope: this part compares `docs/SPEC.md` against the actual source under `src/`
as of this audit. It catalogs every SPEC requirement that is **not yet
implemented**, **partially implemented**, or **implemented but materially
divergent from the spec**.

Legend (same as Part 1):
- **MISSING** — not implemented anywhere.
- **PARTIAL** — exists but key sub-behavior missing or wrong.
- **WRONG** — implemented but the implementation contradicts SPEC.
- **OK** — implemented correctly.

> Note: COMPLETED_TASKS.md claims M1–M17 are all done, but several "completed"
> milestones contain stubs (e.g. `ExportCommand`/`ImportCommand` return
> `{ok:true}` without doing anything; `PackNewCommand` writes a `tmp-${Date.now()}`
> id and never persists to IDB). The audit below is against the code, not the
> milestone status.

---

## P2.1 — Themes

| SPEC requirement | Status | Where / why |
|---|---|---|
| Dark theme palette: terminal green on black (`#0a0a0a`, `#00ff00`, `#003300`, `#005500`, `#0d1a0d`, `#00ff00`) | **WRONG** | `src/ui/theme/themeVars.css` uses a Tokyo Night palette (`#1a1b26`, `#a9b1d6`, `#7aa2f7`, …). Zero overlap with SPEC palette. |
| Light theme palette: GitHub Light (`#ffffff`, `#f6f8fa`, `#d0d7de`, `#0969da`, `#24292f`, `#57606a`, `#cf222e`, `#ddf4ff`) | **WRONG** | Implementation uses a custom grey/indigo palette (`#f5f5f5`, `#3b4261`, `#4c6ef5`). |
| Variable names: `--bg`, `--bg-subtle`, `--border`, `--border-focus`, `--text`, `--text-dim`, `--text-error`, `--highlight-bg`, `--highlight-border` | **WRONG** | Implementation uses an expanded namespace (`--bg-sidebar`, `--bg-grid`, `--bg-cell`, `--bg-overlay-panel`, `--mode-normal`, `--mode-search`, …, `--accent-bg`, `--text-warn`, `--text-ok`, `--scrollbar-thumb`, `--sep`, `--accent-dim`). The SPEC variables `--bg-subtle`, `--highlight-bg`, `--highlight-border` do not exist. |
| JetBrains Mono via Google Fonts | OK | `themeVars.css` line 1 |
| No rounded corners (1px solid) | OK | `themeVars.css` lines 9 (`border-radius: 0 !important`) + various `1px solid` borders |
| Tailwind for layout only, never colors | OK (vacuously — no Tailwind classes used; everything is inline styles + CSS vars) |
| `:theme toggle` command | **MISSING** | `src/app/commands/themeCommands.ts` only handles `dark`/`light`, no `toggle` branch |
| `ctrl+t` keybinding to toggle theme | **MISSING** | `src/app/modes/normalMode.ts` ctrl handlers cover only `ctrl+n` / `ctrl+p` |
| Scrollbars hidden globally (`scrollbar-width: none`, `::-webkit-scrollbar { display: none }`) | **WRONG** | `themeVars.css` lines 141–153 make scrollbars **visible** (6px width, themed thumb). SPEC explicitly says to hide them. |

## P2.2 — Data Model (IndexedDB)

| SPEC requirement | Status | Where / why |
|---|---|---|
| DB `stickerdb` v1, stores `stickers`/`packs`, indexes (`lastUsedAt`, `createdAt`, `packIds` multiEntry) | OK | `src/infra/idb/schema.ts` |
| Sticker / Pack field shapes | OK | `src/domain/entities/sticker.ts`, `pack.ts` |
| `ArrayBuffer` storage; `await file.arrayBuffer()` before write | OK | `src/app/services/importService.ts`, `yankService.ts`, etc. |
| Reconstruct `new Blob([sticker.data], { type: ... })` for clipboard/display | OK | `yankService.ts` line 32, `ui/useObjectURLs.ts` (assumed) |
| `navigator.storage.persist()` on init | OK | `idbDatabase.ts` lines 50–52 |
| Never await foreign async inside an open tx | OK | Services follow the "resolve all bytes outside, then one tx" pattern (`importService.ts`, `packService.ts`, `yankService.ts`) |
| `getAll()` into memory, sort/filter in JS | OK | `idbDatabase.ts` pre-fetches via `getAll` then exposes a `Map` view |
| Wrap all IDB ops in try/catch, surface `E: <message>` | OK | `engine.ts` `handleYankFocused` / `handleDeleteFocused` / `handleRenameFocused` / `handleSetTags` / `handleAssignPacks` / `handleSaveUpload` all `.catch(err => setFlash(...))` |
| **Empty-DB centered hint `press a to add your first sticker` in `var(--text-dim)`** | **MISSING** | `src/ui/Grid.tsx` only shows "No stickers" (without parens, capital N); does not distinguish empty-DB from empty-filter case |

## P2.3 — Layout

| SPEC requirement | Status | Where / why |
|---|---|---|
| Three-region layout, sidebar 180px, statusline 28px | OK | `AppRoot.tsx` |
| No page scroll | OK | `body { overflow: hidden }`, `AppRoot` uses `height: 100vh, overflow: hidden` |
| Scrollbars hidden globally | **WRONG** | see P2.1 |
| **Sidebar header `PACKS [<total>]`** | **MISSING** | `src/ui/Sidebar.tsx` has no header row |
| **Pack row format `> memes [12]` (active) vs `memes [12]` (inactive)** | **WRONG** | `src/ui/PackRow.tsx` uses background color + bright-text for active, no `>` prefix; count rendered without `[ ]` brackets |
| `(ungrouped) [count]` at bottom | **PARTIAL** | Position is correct (`Sidebar.tsx` puts it last), but `[count]` brackets are missing (bare number) |
| Sidebar independently scrollable | OK | `AppRoot.tsx` sidebar div: `overflowY: 'auto'` |
| **Sticker grid: 96×96 contain, name truncated to 12 chars + `..`, dim color** | **PARTIAL** | `StickerCell.tsx`: 96×96 + `object-fit: contain` ✓; dim color ✓; **but** truncation is CSS `text-overflow: ellipsis` (single character `…`), not 12-char-then-`..` SPEC rule |
| Focused cell: highlight border + bg | OK | `StickerCell.tsx` uses `--border-focus` + `--bg-cell-focus`. (Variables aren't the SPEC's `--highlight-*` names but achieve the visual.) |
| **Hover: `transform: scale(1.15)`, z-index raised** | **MISSING** | `StickerCell.tsx` only swaps the background color on hover; no transform, no z-index |
| **Hover tooltip: full name + tags + pack names** | **MISSING** | No tooltip at all (no `title` attribute, no popover). The `alt` attribute is the only tooltip-ish thing and only shows on broken images. |
| Animated GIF via `<img>` | OK | `StickerCell.tsx` line 35 |
| **Empty-grid state: centered `(no stickers)` in `var(--text-dim)`** | **PARTIAL** | `Grid.tsx` shows "No stickers" (capital N, no parens); dim-color ✓ |
| Statusline 28px, always visible, single line, monospace | OK | `AppRoot.tsx` + `Statusline.tsx` |
| Per-mode statusline content | OK | per-mode `statusline()` |
| Flash text replaces left label only | OK | `Statusline.tsx` line 14 |
| Flash error in `var(--text-error)` | OK | `Statusline.tsx` line 34 |

## P2.4 — Modes

| SPEC requirement | Status | Where / why |
|---|---|---|
| All 9 modes registered + dispatched | OK | `modeRegistry.ts` |
| Single-active invariant, atomic `transitionTo` | OK | `engine.ts` `transitionTo` runs onExit→set→onEnter |
| `preventDefault` on every non-modifier key in NORMAL | OK | `KeyboardCapture.tsx` + `normalMode.ts` belt-and-braces |
| Inputs only in statusline, except UPLOAD | OK | `UploadModal.tsx` is the only modal with DOM inputs |

## P2.5 — Keybindings (NORMAL)

| Key | SPEC action | Status | Notes |
|---|---|---|---|
| `h / j / k / l` | grid left/down/up/right | **PARTIAL** | Wired (`normalMode.ts:106–117`), but `j`/`k` move 1 step (cols hardcoded to 1) instead of one row — vertical nav is broken until KeyboardCapture passes the actual column count |
| `gg` (within 500ms) | first sticker | OK | `normalMode.ts:82–94` |
| `G` | last sticker | OK | `normalMode.ts:118–120` |
| **`0`** | first in current row | **MISSING** | `0` is consumed by the digit accumulator (`normalMode.ts:76`) |
| **`$`** | last in current row | **MISSING** | Not in switch |
| **Grid wrap at row edges** (`h` at col 0 → previous-row last col; `l` at last col → next-row first col) | **MISSING** | `intents.ts moveFocusDir` clamps with `Math.max/min`, no wrap |
| `p` | next pack (wraps All → pack1 → … → All) | **WRONG** | Bare `p` opens PACKASSIGN mode (`normalMode.ts:128`). To cycle the user must press `Tab` or `Ctrl+N`. SPEC says `p` cycles. |
| `P` | previous pack | **MISSING** | Bare `P` is unhandled (`normalMode.ts` ctrl-only `p` for backward) |
| `[n]p` | jump to nth pack (1-indexed) | **PARTIAL** | Implemented as "cycle N steps forward" (`normalMode.ts:124–126`), not "jump to Nth absolute index". SPEC says 1-indexed jump. |
| `Enter` | yank | **MISSING** | No `Enter` handler in NormalMode |
| `yy` | yank | **WRONG** | Bare `y` yanks (`normalMode.ts:148`). No two-key sequence. SPEC says `yy`. |
| `a` | UPLOAD | OK | `normalMode.ts:141` |
| `d` | CONFIRM delete | OK | `normalMode.ts:145` |
| `r` | RENAME | OK | `normalMode.ts:143` |
| `t` | TAGS | OK | `normalMode.ts:144` |
| **`m`** | PACKASSIGN | **MISSING** | Bare `m` is unhandled. PACKASSIGN is reached only via bare `p` (which conflicts with the SPEC `p` binding above). |
| `f` | toggle `favourite` tag | **PARTIAL** | Key wired (`normalMode.ts:149`) and intent exists, **but** intent has no handler in engine and no flash. The reducer no-ops on `toggleFavourite`; no service touches IDB. So the user observes nothing. |
| `/` | SEARCH | OK | `normalMode.ts:139` |
| **`n`** | next search match (wraps) | **WRONG** | No `n` handler in NORMAL. `Ctrl+N` cycles selection (re-purposed). |
| **`N`** | previous search match | **MISSING** | No `N` handler. |
| `:` | COMMAND | OK | |
| `?` | HELP | OK | |
| **`ctrl+t`** | toggle theme | **MISSING** | Only `:theme dark`/`:theme light` exist (no `toggle` arg, no keybinding) |

## P2.6 — Mode-specific keys

| Mode / key | SPEC | Status |
|---|---|---|
| SEARCH `Esc` clears search and goes NORMAL | **WRONG** | `searchMode.ts:37–40` **reverts** the search to its pre-enter value, rather than clearing. (e.g. if you enter SEARCH with `search=""`, behavior matches; but if you already had a search and re-enter SEARCH, Esc keeps the old search instead of clearing.) |
| SEARCH `Enter` locks filter | OK (behavior matches because search updates live; "lock" is implicit) |
| COMMAND `Tab` autocomplete first token | **MISSING** | `commandMode.ts` does not handle `Tab` at all |
| COMMAND `Esc` cancel | OK |
| COMMAND `Backspace` on empty buffer | **EXTRA** | Exits to NORMAL when buffer is empty (`commandMode.ts:60–66`). SPEC does not specify this; harmless but non-spec. |
| CONFIRM `y`/`n`/`Esc` | OK |
| RENAME `Enter` save | OK (non-empty validation in `renameMode.ts:37–43`) |
| RENAME `Esc` cancel | OK |
| TAGS `Enter` save (trim, drop empty) | OK |
| TAGS `Esc` cancel | OK |
| PACKASSIGN `Enter` save (find-or-create packs) | OK |
| PACKASSIGN `Tab` complete current token | **MISSING (in statusline mode)** | `packAssignMode.ts:59–62` is an explicit stub: "Tab-completion of the current token is wired in M7." (It IS wired in the UploadModal DOM-input variant, `UploadModal.tsx handlePacksKeyDown`, but not in the statusline PACKASSIGN mode entered via `p`/`m`.) |
| PACKASSIGN removing a name removes that membership | OK (the reducer overwrites `packIds` to the resolved set, so dropped names disappear) |
| UPLOAD `Ctrl+V` paste image | OK | `UploadModal.tsx` window paste handler |
| UPLOAD `Enter` save all | OK | `uploadMode.ts:39–43` (also `ADD ALL` button in UI) |
| UPLOAD `Esc` close without saving | OK (queue cleared in `onExit`) |
| HELP `q`/`Esc` close | OK |

## P2.7 — Command Palette

| Command | Status | Notes |
|---|---|---|
| Trie resolver, longest-path wins, E492 on miss | OK | `registry.ts` |
| `:pack new <name>` | **WRONG** | `packCommands.ts:13–25` uses `tmp-${Date.now()}` as id (not UUID), writes only to in-memory `applyPack` intent, **never persists to IDB**. Page reload loses the pack. Comment says "Persistence is wired in M8" but it isn't. |
| `:pack rename <name>` | **WRONG** | Same problem — `applyPack` only, no IDB write |
| `:pack delete` | **WRONG** | Removes pack from in-memory state only; **does not strip `packId` from affected stickers** (SPEC requires); **does not persist** |
| **`:pack move <name>`** | **MISSING** | No such command registered; `PackService` has `assignPacks` but no `:pack move` command exposes it |
| `:tag add <tag>` | **WRONG path** | Registered as `tags add` (plural) instead of `tag add` (`tagCommands.ts:11`). SPEC uses singular `tag`. Also no IDB persistence — uses `setTags` intent which has no engine handler call to IDB (wait — there IS `handleSetTags` in engine.ts that calls the service). Actually the dispatch goes via `setTags` intent and engine.handleSetTags persists. OK on persistence. But path is wrong. |
| `:tag remove <tag>` | **WRONG path** | Same — registered as `tags remove` |
| **`:tag rename <old> <new>`** | **MISSING** | Not registered; no global-rename service exists |
| `:tags clear` | **EXTRA / not in SPEC** | `tagCommands.ts:37–46` — not in SPEC |
| `:sort recent/added/name` | OK | `sortCommands.ts` |
| `:export` | **MISSING** | `ioCommands.ts:4–10` returns `{ok:true}` without calling ExportService, building any zip, or triggering any download |
| `:import` | **MISSING** | Same — `ioCommands.ts:12–18` is a no-op stub. No file-picker invocation, no `ImportService.importZip` call, no flash. |
| `:theme toggle` | **MISSING** | `themeCommands.ts` only handles `dark`/`light` literals |
| `:theme dark` / `:theme light` | OK |
| `:help` | OK |

## P2.8 — Help Modal

| SPEC requirement | Status | Where / why |
|---|---|---|
| Triggered by `?` or `:help` | OK | `normalMode.ts` + `helpCommand.ts` |
| **Sidebar + statusline remain visible** | **WRONG** | `HelpModal.tsx` uses `position: fixed; inset: 0` — covers the entire viewport including sidebar and statusline. SPEC says only the grid should be covered. (Compare `UploadModal.tsx` which correctly does `top: 0; left: 180; bottom: 28`.) |
| Semi-transparent backdrop | OK (uses `--bg-overlay`) |
| **Two-column layout: NORMAL keys left, command palette right** | **WRONG** | `HelpModal.tsx` is a single-column layout with grouped sections (Navigation/Actions/Modes/Close). **No command palette is listed at all** (`:pack new`, `:tag add`, `:sort`, `:export`, etc. are not shown). |
| Read-only, monospace, themed via CSS vars | OK |
| `q`/`Esc` close | OK (HelpMode owns these) |

## P2.9 — Editing Sticker Metadata

| SPEC requirement | Status | Where / why |
|---|---|---|
| RENAME prefill with current name | OK | `renameMode.ts:21–24` |
| RENAME non-empty validation | OK | `renameMode.ts:37–43` (silently aborts on empty) |
| RENAME collision append `(2)`, `(3)` scoped to same packs | OK | `yankService.renameSticker` calls `resolveNameCollision` |
| **RENAME flash `renamed: <newname>`** | **MISSING** | No success flash anywhere — engine only flashes errors. |
| TAGS prefill comma-separated | OK | `tagsMode.ts:20–24` |
| TAGS parse (trim + drop empty) | OK | `tagsMode.ts:36–41` |
| PACKASSIGN prefill | OK | `packAssignMode.ts:22–32` |
| PACKASSIGN Tab completes current token (statusline path) | **MISSING** (see P2.6) |
| PACKASSIGN save: find-or-create | OK | `packService.assignPacks` |
| PACKASSIGN removing pack name removes membership | OK |

## P2.10 — Upload Modal

| SPEC requirement | Status | Where / why |
|---|---|---|
| Triggered by `a` | OK | `normalMode.ts:141` |
| Overlay covers grid only (sidebar + statusline visible) | OK | `UploadModal.tsx` lines 172–185 uses `top:0; left:180; bottom:28` |
| Semi-transparent backdrop, theme-specific rgba | OK | uses `--bg-overlay` (dark `rgba(0,0,0,0.65)`, light `rgba(0,0,0,0.35)`); SPEC says `rgba(0,0,0,0.7)`/`rgba(255,255,255,0.7)` — close, but not exact. Light theme uses dark overlay (SPEC says light theme uses *light* overlay) |
| Drop zone: dashed border + `DROP STICKERS HERE` | OK | `UploadModal.tsx` lines 215–236 |
| Accepts PNG/GIF/WebP/APNG | **PARTIAL** | `SUPPORTED_MIME = ['image/png', 'image/gif', 'image/webp']`. APNG mime (`image/apng`) is **not in the accept list**, so APNG files via picker or drop are filtered out as unsupported. (Per `mime.ts` the type is `image/png` only, but browsers usually report APNG as `image/apng` — these will be rejected.) |
| Click drop zone → multi-select file picker | OK |
| `Ctrl+V` paste from clipboard | OK |
| Queue row: 48×48 thumbnail | OK |
| Queue row: name input prefilled (filename minus extension) | OK | `FileStickerCandidate.defaultName` = `stripExtension(file.name)` |
| Queue row: tags input + placeholder `tags...` | **WRONG label** | UI shows label `Tags (comma-separated)` instead of placeholder `tags...` |
| Queue row: pack input + placeholder `packs...` + tab-completes | **PARTIAL** | Tab-complete ✓; label is `Pack (Tab to complete)` instead of placeholder `packs...` |
| Queue row: `x` button to remove | OK | `UploadModal.tsx` lines 427–443 (uses `×`) |
| **`ADD ALL` button as alternative to Enter** | OK | line 280 |
| Save: resolve all bytes, single tx, create missing packs | OK | `ImportService.saveUpload` |
| After save: close modal, refresh grid, **flash `added: N stickers`** | **PARTIAL** | Modal closes (saveUpload clears queue → UPLOAD transitions to NORMAL via `Enter` key)… but **no flash**. `engine.handleSaveUpload` doesn't emit one. |
| `Esc` close without saving; revoke thumbnails | OK |

## P2.11 — Clipboard (Yank)

| SPEC requirement | Status | Where / why |
|---|---|---|
| Construct Blob, write via ClipboardItem | OK | `navigatorClipboard.ts`, `yankService.yank` |
| Update `lastUsedAt` | OK | `yankService.ts:38` |
| **Success flash `yanked: <name>`** | **MISSING** | `yankService.yank()` returns the updated sticker; no flash is emitted. |
| Download fallback: object URL + `<a download>` + auto-click + revoke | OK | `composition.ts:19–28` `downloadFallback` |
| Extension from mime via decision-G map | OK | `mimeExtension` used in `exportService` (and would be used in fallback if name included an extension). **Note:** `downloadFallback` uses `name` as-is — does not append the mime extension. So a sticker named `pepe` downloads as `pepe` with no extension. |
| **Failure flash `(no clipboard: downloading)`** | **MISSING** | No flash emitted on clipboard failure either |

## P2.12 — Search

| SPEC requirement | Status | Where / why |
|---|---|---|
| Substring match, name + tags, case-insensitive | OK | `searchPredicate.ts` |
| AND-composed with active SidebarSelection | OK | `appState.computeVisibleGrid` |
| Real-time filtering while typing | OK | `searchMode.ts handleKey` updates on every keystroke |
| Match count shown in statusline | OK | `searchMode.statusline` |
| `Esc`: clear search, keep pack filter | **WRONG** | Esc reverts to *pre-enter* value (see P2.6) instead of clearing. To "clear" via Esc you must enter SEARCH with `search === ""`. |
| `Enter`: lock filter | OK (live updates leave the search in state) |
| **`n` / `N` in NORMAL: cycle filtered results, wraps** | **MISSING** | No `n`/`N` in NormalMode for search nav. (`Ctrl+N` cycles selection.) |

## P2.13 — ZIP Export / Import

| SPEC requirement | Status | Where / why |
|---|---|---|
| `:export` works | **MISSING** | `ExportCommand` is a no-op stub (`ioCommands.ts`) |
| Export filename `stickerdb-export-<YYYY-MM-DD>.zip` | **MISSING** | No download trigger; no filename builder |
| Output ZIP layout (`manifest.json` + `stickers/<id>.<ext>`) | **WRONG** | `ExportService.exportStickers` puts files at zip root (`<id>.<ext>`), not under `stickers/` |
| Manifest schema: `{version, exportedAt, packs[], stickers[].file}` | **WRONG** | `ZipManifest`: missing `exportedAt`; entry uses `filename` not `file`; export always sets `packs: []` (does not include `Pack` records — packs are dropped) |
| Export flash `exporting... done: N stickers` | **MISSING** | No flash |
| `:import` works | **MISSING** | `ImportCommand` is a no-op stub |
| `.zip`-only picker | OK (in port; would work if `ImportCommand` actually called it) |
| Parse manifest, materialize buffers | OK (in `ImportService.importZip`, but unreachable from the command) |
| Resolve all `file.async()` before any IDB tx | OK |
| Single tx for all writes | OK |
| **Skip pack by existing `id`** | **MISSING** | `ImportService.importZip` always generates new UUIDs (`uuid()`) for incoming packs; dedup is by name only |
| **Skip sticker by existing `id`** | **MISSING** | Always generates new UUIDs for incoming stickers |
| **Flash `imported: N stickers, M packs (K skipped)`** | **MISSING** | No flash; no skip-count returned |

## P2.14 — Edge Cases

| SPEC | Status | Where / why |
|---|---|---|
| `gg` within 500ms via keysequence buffer | OK | `normalMode.ts:82–94` |
| `[n]p` digit buffer, 1s timeout | **PARTIAL** (semantics differ — see P2.5) |
| Name collision append `(2)`, `(3)` per-pack scope | OK | `resolveNameCollision.ts` (uses ` (2)` with a space — SPEC examples don't specify; acceptable) |
| **Pack name max display 14 chars + `..`** | **WRONG** | `PackRow.tsx` uses CSS ellipsis (no 14-char cap) |
| **Sticker name max display 12 chars + `..`** | **WRONG** | `StickerCell.tsx` uses CSS ellipsis |
| PACKASSIGN tab-complete current token, not whole string | **PARTIAL** | Implemented in `UploadModal` queue row; **not** implemented in the statusline PACKASSIGN mode |
| `:pack delete` strips packId from affected stickers in same tx | **WRONG** | `PackDeleteCommand` does neither — see P2.7. (The `PackService.deletePack` method does it correctly, but the command never calls the service.) |
| `(ungrouped)` is virtual | OK |
| **Grid focus wrap at row edges** | **MISSING** | `moveFocusDir` clamps with min/max |
| **Empty grid + action key = silent no-op** | **PARTIAL** | `yankFocused`/`deleteFocused` etc. early-return in the engine when `focusId === null`. **However**, `r`/`t`/`d` still call `engine.transitionTo(...)` from NormalMode — the user enters an empty RENAME/TAGS/CONFIRM mode with no focused sticker. SPEC requires these to be silent no-ops when the grid is empty. |
| Animated GIF via `<img>` | OK |
| Duplicate name on upload → append `(2)` | OK | `ImportService.saveUpload` uses `resolveNameCollision` |

---

## P2.15 — Other implementation notes (not strictly SPEC gaps)

These are doc-implementation deviations worth flagging:

- **FlashScheduler uses `setTimeout` directly, not the `Clock` port.** STATE.md says the timer is "`Clock`-driven." `src/app/engine/flash.ts` constructs setTimeout without consulting the injected `Clock`. Functional but breaks substitutability — a fake clock cannot advance the flash timer in tests.
- **`PackNewCommand` invents a non-UUID id (`tmp-${Date.now()}`).** Even if it eventually wires to IDB, the id contract in DOMAIN.md says packs always have a real UUID.
- **`toggleFavourite` intent reaches the reducer but the reducer no-ops it; no service handler exists in engine.ts.** The keystroke `f` does literally nothing today (no IDB write, no UI change, no flash).
- **`KeyboardCapture` does not pass actual grid column count to `moveFocusDir`.** NormalMode hardcodes `cols: 1`, making `j`/`k` effectively the same as `h`/`l` (move one cell, not one row). The comment in NormalMode admits this is "M5 placeholder; M12 wires actual column count" but M12 never did.
- **`UploadModal` rejects APNG.** The constant `SUPPORTED_MIME` doesn't include `image/apng`. SPEC says APNG must be accepted (stored as `image/png`). DOMAIN.md decision G allows this but the modal's mime filter blocks it.
- **`ImportCommand`/`ExportCommand` are stubs** — see P2.7 / P2.13.
- **`HelpModal` covers the whole viewport** — see P2.8.
- **`Statusline` does not visually distinguish `mode` left-label by mode color**, though the CSS file defines `--mode-normal`, `--mode-search`, … vars for it. The `Statusline.tsx` always uses `inherit`. (Not a SPEC violation, just dead vars.)

---

## P2.16 — Missing-feature punch list (TL;DR)

Quick priority list of net-new work needed to satisfy SPEC. Group by area.

### Critical functional gaps
1. **Wire `:export` and `:import` commands** to the existing services and the file picker / download. Without these, the SPEC's headline ZIP feature is non-existent.
2. **Fix pack commands** (`:pack new/rename/delete`) to call `PackService` so changes persist; implement `:pack delete`'s sticker-side cleanup; add `:pack move <name>`.
3. **Fix tag command paths** to `tag` (singular); remove `:tags clear`; add `:tag rename <old> <new>`.
4. **Implement `f` (toggle favourite)** end-to-end: add `handleToggleFavourite` in engine, wire to service, emit `tagged: favourite`/`untagged: favourite` flash.
5. **Implement `yy` two-key yank** + `Enter` yank + success flash `yanked: <name>` + clipboard-failure flash.
6. **Implement `m` keybinding** for PACKASSIGN; **rebind `p` / `P` / `[n]p`** to pack cycling per SPEC.
7. **Implement `n` / `N`** for search-match navigation in NORMAL.
8. **Implement `0` / `$`** for row start/end navigation.
9. **Implement grid focus wrap** at row edges.
10. **Implement `ctrl+t`** and `:theme toggle`.
11. **Fix SEARCH `Esc`** to clear `search` rather than revert.
12. **Silent no-op for action keys** (`d`/`r`/`t`/`m`/`yy`/`Enter`) when grid is empty — currently they still enter the empty-input modes.

### Visual / UX gaps
13. **Replace theme palette** with SPEC's terminal-green / GitHub-Light values (or update SPEC to match implementation — pick one).
14. **Hide scrollbars** per SPEC (`scrollbar-width: none`, hide `::-webkit-scrollbar`).
15. **Pack sidebar header** `PACKS [N]`.
16. **Pack row `>` active marker + `[count]` brackets + 14-char `..` truncation**.
17. **Sticker name 12-char `..` truncation** (the SPEC-specified rule, not CSS ellipsis).
18. **Hover transform** (`scale(1.15)` + raised z-index) + **tooltip** (name + tags + pack names) on grid cells.
19. **Empty-DB hint** `press a to add your first sticker` (in dim color).
20. **Empty-grid message** lowercase `(no stickers)` with parens.
21. **HelpModal**: don't cover sidebar/statusline; switch to two-column NORMAL-keys-left / command-palette-right layout; include all command-palette entries.
22. **UploadModal**: accept APNG; use placeholder text (`tags...`, `packs...`) instead of labels (or have both); align backdrop rgba with SPEC (light theme uses light overlay).

### Flash / messaging gaps
23. Success flashes are missing across the board: `yanked:`, `renamed:`, `tagged: favourite` / `untagged: favourite`, `added: N stickers`, `imported: N stickers, M packs (K skipped)`, `exporting... done: N stickers`. Plus `(no clipboard: downloading)`.

### Command palette gaps
24. **COMMAND `Tab` autocomplete** (first token) — completely unimplemented.

### Persistence gaps
25. Pack create/rename/delete via commands do not write to IDB (reload = data loss).
26. ImportService generates new UUIDs instead of preserving manifest ids; no dedup by id.

### Architectural drift to fix
27. FlashScheduler should consult the injected `Clock`, not `setTimeout` directly.
28. `KeyboardCapture` should pass the actual grid column count to `moveFocusDir`; otherwise `j`/`k` is broken for 2-D nav.
29. PACKASSIGN statusline mode needs the same Tab-completion logic the UploadModal queue row already has.

---

# Part 3 — Implementation errors against ANY doc

Scope: in this section "doc" means *any* of SPEC.md, ARCHITECTURE.md, DOMAIN.md,
IDB.md, MODES.md, STATE.md, COMPLETED_TASKS.md, or CLAUDE.md. Items already
listed in Part 2 are not duplicated unless they violate a *different* doc
than the SPEC violation already noted there. Each entry quotes (or paraphrases)
the contract being violated.

Sections P3.1–P3.9 are grouped by the doc whose contract is broken; the final
P3.10 collects multi-doc / general bugs.

---

## P3.1 — Errors against ARCHITECTURE.md

### P3.1.1 — Missing `app/upload/` directory (entire layer absent)
ARCHITECTURE.md §directory tree:
```
app/
  upload/
    stickerCandidate.ts   # interface
    fileCandidate.ts clipboardCandidate.ts uploadQueue.ts
```
None of these files exist. `StickerCandidate` is in `src/domain/values/stickerCandidate.ts`. Concrete `FileStickerCandidate` and `ClipboardStickerCandidate` are **inlined into `src/ui/overlays/UploadModal.tsx:40–82`** — a UI file. `uploadQueue.ts` has no equivalent at all.

**Effect.** Two real LSP-substitutable subtypes of `StickerCandidate` live in the UI layer with no chance of being reused or tested independently of UploadModal. Reusing them from any non-UI consumer (e.g. an `:upload` command, an import path, a future test) requires hoisting them out.

### P3.1.2 — `StickerCandidate` placed in `domain/` not `app/upload/`
ARCHITECTURE.md lists `stickerCandidate.ts` under `app/upload/`. DOMAIN.md *also* describes it. Either the tree placement is wrong, or DOMAIN.md is wrong about it being a domain concept. **The two docs contradict each other**, and the code follows DOMAIN.md (places it under `domain/`).

### P3.1.3 — Missing entity factories
ARCHITECTURE.md tree comment: `sticker.ts            # Sticker type, invariants, factory` and `pack.ts               # Pack type, invariants, factory`. The current `src/domain/entities/sticker.ts` and `pack.ts` contain only `interface` declarations — no factory function, no invariant guard.

**Effect.** Construction sites (e.g. `ImportService.saveUpload`, `PackService.createPack`) hand-build entity objects inline with `{ id: ..., name: ..., createdAt: ..., ... }`. Any future invariant (e.g. "name non-empty", "packIds deduped") would have to be added in many places.

### P3.1.4 — `Date.now()` used outside `infra/system/`
ARCHITECTURE.md module table: `app/{engine,modes,commands,services,upload}/**` **must not** import "browser globals." The Clock port exists in `app/ports/clock.ts` precisely so app code routes through it.

Violator: `src/app/commands/packCommands.ts:22`
```ts
pack: { id: `tmp-${Date.now()}`, name, createdAt: Date.now() }
```
`Date.now()` is a JS global, not strictly a browser global, but the *intent* of the Clock abstraction (per `clock.ts:1–2`: "so flash scheduling and createdAt/lastUsedAt can be controlled in tests") is bypassed. Services route through the injected `Clock`; this command does not.

### P3.1.5 — `setTimeout` used in `app/engine/flash.ts` and `app/modes/normalMode.ts`
Same family of violation as P3.1.4. `setTimeout` is a host global. STATE.md §Flash scheduling explicitly says the timer is `Clock`-driven. The code uses raw `setTimeout` in both places. (NormalMode's gg/digit timers are not specifically called out as Clock-driven in MODES.md decision H, but the spirit — testable, mockable timing — is the same.)

### P3.1.6 — Sibling app cross-import: services → engine
ARCHITECTURE.md module table says `app/{engine,modes,commands,services,upload}/**` MAY import only `domain/**` and `app/ports/**`.

Violator: `src/app/services/importService.ts:7`
```ts
import type { QueuedSticker } from '../engine/appState';
```
This is a service reaching into engine state-shape — exactly what the table forbids. The correct home for `QueuedSticker` would have been `app/upload/uploadQueue.ts` (per P3.1.1).

### P3.1.7 — Hardcoded color in UI overlay
M11 acceptance criterion: "no Tailwind hardcoded colors (all via `var(--*)`)."

Violator: `src/ui/overlays/UploadModal.tsx:285`
```ts
color: uploadQueue.length > 0 ? '#000' : 'var(--text-dim)',
```
`#000` is a hardcoded color string.

### P3.1.8 — `transitionTo` is not actually atomic from observers' perspective
ARCHITECTURE.md macro-decision #2: "The Mode FSM is a single substitution site." MODES.md §Decision B says `transitionTo` runs atomically: `current.onExit → set modeName → next.onEnter`.

Implementation (`engine.ts:240–260`):
```ts
current?.onExit(handle);                                  // may dispatch (notifies)
this.dispatch({ type: 'transitionMode', modeName: name }); // notifies
next.onEnter(handle);                                     // may dispatch (notifies)
```
Each step that mutates state triggers `notify()` in `dispatch`, calling every React subscriber **between** steps. From React's view there are 1–3 separate renders during a transition, not one. For example, when leaving SEARCH: `onExit` setStatusInput('') → notify → transitionMode → notify → onEnter (NormalMode no-op).

**Effect.** UI may render an inconsistent intermediate state (statusInput cleared but mode still SEARCH; or mode changed but onEnter prefill not yet applied). Usually invisible because synchronous JS finishes before paint, but the "atomic" claim is misleading.

### P3.1.9 — `bootstrap/composition.ts` swap is not "a one-line change"
ARCHITECTURE.md composition-root contract + M10 acceptance: "the swap is a one-line change at the composition root." `composition.ts:34–41` has **eight** independent `new IdbFoo()` / `new NavigatorFoo()` constructions; swapping fakes requires editing all eight. Spirit is intact (each swap is local), but the "one-line" claim from M10 is inaccurate.

---

## P3.2 — Errors against DOMAIN.md

### P3.2.1 — `Pack` UUID invariant violated by `PackNewCommand`
DOMAIN.md §Entities: "Invariant: a `Pack` always has a persisted UUID `id`. This invariant is the reason All/Ungrouped are NOT packs."

Violator: `src/app/commands/packCommands.ts:22`
```ts
pack: { id: `tmp-${Date.now()}`, name, createdAt: Date.now() }
```
`tmp-${Date.now()}` is not a UUID. The pack also has no persistence (P2.7), so this `tmp-…` id never gets replaced — it leaks into the in-memory `state.packs` and into `PackSelection.key === 'pack:tmp-…'`. Reload loses the pack entirely.

### P3.2.2 — `PackService.assignPacks` ignores its `_allStickers` argument
DOMAIN.md §Decision F mandates per-pack collision resolution: "name must be unique among co-members of *each* pack."

Violator: `src/app/services/packService.ts:68–105`. The signature accepts `_allStickers` but never calls `resolveNameCollision`. So if a sticker is moved into a pack where its name already exists, the duplicate is allowed.

**Effect.** Calling `:pack move "foo"` (or its UI equivalent) onto a sticker named `pepe` when pack `foo` already has a `pepe` produces two `pepe`s in the same pack — exactly the collision DOMAIN.md decision F is supposed to prevent.

### P3.2.3 — `ExportService` drops pack metadata
DOMAIN.md doesn't directly mandate the manifest schema, but the export pipeline produces a `ZipManifest` whose `packs` field is typed as `ZipPackEntry[]`.

Violator: `src/app/services/exportService.ts:33–34`
```ts
packs: [],
```
Always empty. Service signature only takes `stickers` — packs aren't even passed in. So the export loses all `Pack` records; on re-import you'd lose pack names that have no current member sticker.

### P3.2.4 — `Mode.statusline()` TOTAL-output contract: missing edge case
DOMAIN.md / MODES.md require `statusline()` to "always return a renderable model, never throws."

Subtle issue: `searchMode.statusline()` (`searchMode.ts:65–73`) calls `computeVisibleGrid(state)` on every render. If `state.stickers` is enormous and `searchPred` is the empty predicate, this re-filters and re-sorts the entire collection on every keystroke + every render. Not "never throws" wise, but a sub-clause of TOTAL-output ("renderable") becomes a soft real-time worry. Not a bug, but a doc-implementation correctness concern when scaled.

---

## P3.3 — Errors against IDB.md

### P3.3.1 — `IdbDatabase.tx` opens TWO transactions, not one
IDB.md §Concrete IDB schema + Transaction discipline says "one tx per operation" and the pattern shown is "open a single transaction to write all results."

Violator: `src/infra/idb/idbDatabase.ts:55–122`. The implementation:
1. Opens a **readonly** tx, calls `getAll` on each store, awaits completion.
2. Then opens a **separate readwrite** tx and runs the body.

Between (1) and (2) another writer can commit, making the prefetched view stale. The body's `repo.get(scope, id)` reads from the stale snapshot; `repo.put(scope, …)` writes the stale data back, overwriting the concurrent writer's change.

**Effect.** In a single-tab app the race is hypothetical, but the implementation does not honor "one transaction per operation." The `FakeDatabase` correctly does it in one synchronous step (no race), so the two implementations are *not LSP-substitutable* under multi-writer scenarios — directly violating LSP macro-decision #1.

### P3.3.2 — IDB repo errors are silently swallowed at the request level
IDB.md decision J: "Any failure throws."

Violator: `src/infra/idb/idbStickerRepository.ts:22, 29` and `idbPackRepository.ts:19, 26`:
```ts
s.idbTx!.objectStore('stickers').put(entity).onerror = () => {};
```
This empty handler suppresses the request-level error event. The error still propagates to the transaction (because the handler doesn't call `event.preventDefault()`, which is what would actually stop abort), so the tx promise eventually rejects via `onabort`. **But** the empty handler is structurally identical to the "swallow silently" pattern IDB.md explicitly forbids ("A fake that 'succeeds silently' weakens the contract and is forbidden"). A future reader could easily change it to `() => { e.preventDefault() }` and break the contract for real.

Recommendation: replace with `onerror = (e) => { /* let it bubble */ }` and a comment explaining the intent, or delete the assignment (default behavior).

### P3.3.3 — Fake `tx` doesn't enforce store-restriction
IDB.md describes `tx<T>(stores, mode, body)` where `stores` is the list of stores the body is allowed to touch. Real IDB throws if you access an unlisted store.

Violator: `src/test/fakes/fakeDatabase.ts:60–71`. The `_stores` argument is ignored (`_` prefix). The fake exposes BOTH stores in every tx regardless. If a body issues `repo.put(scope, ...)` on a store not listed in `stores`, the real adapter would throw but the fake silently succeeds.

**Effect.** Breaks LSP substitutability — tests can write code that "works" against the fake but throws against the real adapter.

### P3.3.4 — Fake `tx` doesn't enforce "no foreign awaits"
IDB.md §Transaction discipline: "a `tx` body that awaits foreign async must fail the same way the real one does."

Both `FakeDatabase.tx` and `IdbDatabase.tx` invoke `body(scope)` synchronously and return whatever `body` returns. If a body is `async (scope) => { await someForeignThing; repo.put(scope, ...) }`, the body returns a Promise that resolves *after* the synchronous return — but the real IDB tx will have auto-closed by then, so the `repo.put` call throws "Transaction is finished." The fake, however, has no concept of "closed tx," so the put succeeds.

Real and fake do **not** "fail the same way." LSP claim is violated for any test that uses an async body.

### P3.3.5 — `FakeDatabase` allows reads outside of any tx through the same scope
IDB.md decision: "`getAll`/`put`/`delete` are valid only inside a provided `TxScope`."

In `FakeDatabase.tx`, the `FakeTxScope` is constructed once and given to `body`. If `body` stores the scope on a closure and the consumer later calls `repo.get(savedScope, id)` after `tx()` resolved, the fake happily reads from the *committed* maps because the scope's `view` map still references them. Real IDB would throw "Transaction is finished."

**Effect.** Test code can accidentally rely on long-lived scopes that the real adapter would reject. Another LSP-substitution leak.

### P3.3.6 — `IdbDatabase.tx` doesn't validate `stores` parameter for prefetch
If a caller passes `stores: ['stickers']` but the body calls `packs.put(scope, …)`, the body will try to access an objectStore not in the IDB transaction — real IDB throws synchronously. Good.

But the prefetch step ONLY fetches stores listed in `stores`, so `scope.view.packs` is empty. Then the body's `packs.get(scope, id)` returns `undefined` (stale-empty), which the body might interpret as "no such pack." Silent wrong data flow.

The schema-layer fix is to either (a) include all stores in prefetch even if not listed (wasteful), (b) document that callers must list every store they intend to touch, or (c) throw if `scope.view.packs` is accessed but `packs` wasn't in `stores`.

Currently (b) is implicit but undocumented in IDB.md.

### P3.3.7 — `IdbDatabase.tx` does not reject foreign-async bodies (same as P3.3.4 for real adapter)
The real IDB tx auto-closes when the microtask queue drains. The implementation calls `body(scope)` synchronously, then `await txComplete`. If `body` is `async`, the returned promise outlives the synchronous part — but `txComplete` will likely resolve before that promise. The implementation doesn't detect this; it just returns whatever the body returned, which may be a pending Promise<T>. The wrong order of awaits silently produces wrong results.

---

## P3.4 — Errors against MODES.md

### P3.4.1 — `SearchMode` holds non-statusInput mode-internal state
MODES.md §Decision H authorizes `gg`/`[n]p`/digit buffers as NormalMode-internal — these are the **only** named mode-internal state. Decision I: every onExit clears `statusInput`. No other mode-internal state is sanctioned.

Violator: `src/app/modes/searchMode.ts:23`
```ts
private searchOnEnter = '';
```
This is a per-mode private field that persists across `handleKey` calls and is reset on `onEnter`. It's used so `Esc` can revert the search to its pre-enter value. Neither MODES.md nor any other doc allows this state. (As an aside, it also makes the Esc behavior diverge from SPEC — see P2.6.)

### P3.4.2 — `CommandMode` Backspace-on-empty-buffer exit not in MODES.md
MODES.md per-mode table: COMMAND `onExit — statusInput cleared`. The transition out of COMMAND happens only on `Enter` or `Escape` per MODES.md decision C/per-mode table.

Violator: `src/app/modes/commandMode.ts:60–66` adds an extra exit on Backspace-when-empty-buffer. Harmless and arguably nice UX, but undocumented behavior.

### P3.4.3 — `commandMode` does not handle `Tab` (MODES.md §Decision C requires it)
MODES.md decision C table: COMMAND `input | :buffer (tab-completes 1st token)`. Implementation has no Tab branch (`commandMode.ts` `handleKey`). The trie resolver in `app/commands/registry.ts` exposes no completion API either.

### P3.4.4 — `packAssignMode` does not handle `Tab` (MODES.md §Decision C)
Same as above: `packAssignMode.ts:59–62` is explicitly a stub. (UploadModal queue row implements completion but only for its own input.)

### P3.4.5 — `Mode.handleKey` total-input contract: input modes drop shift key info
MODES.md §Mode interface: `KeyEvent.shift` is part of the canonical event shape.

Violator: `searchMode.ts:33`, `commandMode.ts:34`, `renameMode.ts:28`, `tagsMode.ts:28`, `packAssignMode.ts:37`:
```ts
const { key, ctrl, alt, meta } = evt;  // shift dropped
```
This means `Shift`-modified printable characters work (because `key` already reflects shift in `key.length === 1`), but combinations like `Shift+Enter` are indistinguishable from `Enter`. Not a SPEC requirement to handle Shift+Enter, but the input ignores the shift state instead of being explicit.

### P3.4.6 — `transitionTo` no-ops when target mode is unregistered, instead of throwing
MODES.md doesn't say what happens if the target mode is unknown — but the **mode contract** says modes are registered in a registry. Implementation:

`engine.ts:243–247`:
```ts
const next = this.registry.get(name);
if (next === null) {
  this.setFlash(`mode ${name} not yet implemented`, true);
  return;
}
```
This is M5-era scaffolding for a partial registry. With M6+ done, every ModeName has a registered Mode. The fallback flash is now dead code that masks a real bug if a mode is ever deregistered. The contract should be "registry contains every ModeName"; the implementation should `throw new Error("invariant: ModeRegistry missing " + name)` and let the engine's catch boundary turn it into a flash.

### P3.4.7 — `confirmMode.statusline()` returns a different shape when there's no focused sticker
MODES.md decision C: CONFIRM `hint: delete "name"? [y/n]`. Implementation:

`confirmMode.ts:62–66`:
```ts
const hint = this.pending !== null
  ? `delete "${this.pending.stickerName}"? [y/n]`
  : '[y/n]';
```
The `[y/n]` fallback is undocumented. SPEC + MODES.md never describe a focus-less CONFIRM. (Should never happen if NormalMode guards `d` per P2.14, but currently it doesn't.) Result: user sees `CONFIRM [y/n]` with no context. Either guard the entry (P2.14) or make the empty case a no-op transition back to NORMAL.

### P3.4.8 — `UploadMode.onExit` clears queue via per-row dispatch loop
MODES.md per-mode table: UPLOAD `onExit | clears uploadQueue, revokes thumbnail object URLs`.

Implementation (`uploadMode.ts:62–67`) calls `engine.dispatch({ type: 'removeQueueRow', index: i })` in a loop. Each dispatch synchronously runs the reducer and calls `notify()`. If the queue has 20 rows, subscribers see 20 intermediate snapshots — yet AppState has a `clearUploadQueue` intent that does it in one step (`intents.ts:231–232`). The single-intent path is the natural one and is already implemented; the loop is wasteful.

### P3.4.9 — `Mode.onEnter` total contract: assumes prior mode behavior
MODES.md §Mode interface LSP annotation: "onEnter — idempotent; must not assume any particular prior mode."

`searchMode.onEnter` reads `state.search` and writes it to `statusInput`. Fine.
`renameMode.onEnter` reads `state.focusId` and uses it to find a sticker. Fine if focus is null → empty input. OK.
`packAssignMode.onEnter` same.
`tagsMode.onEnter` same.
`confirmMode.onEnter` same.

But: `uploadMode.onEnter` is a no-op. The comment says it relies on prior queue state ("uploadQueue may already have items from a prior Ctrl+V paste"). That's "depends on what state the previous mode left," which technically violates the "must not assume" annotation. Practically, this is the intended behavior (Ctrl+V outside UPLOAD mode shouldn't be possible — but the UploadModal listens to `window` paste so it only fires when UPLOAD is active anyway). Annotation drift, not a real bug.

---

## P3.5 — Errors against STATE.md

### P3.5.1 — Intent catalog is missing entries from the actual reducer
STATE.md §Intent catalog lists 20 intent names. The actual `Intent` union in `src/app/engine/intents.ts:18–66` has **27** variants. The seven extras are:
- `moveFocusDir` (STATE lists only `moveFocus(dir|target)`, code splits)
- `applySticker`
- `applyStickers`
- `removeSticker`
- `applyPack`
- `removePack`
- `clearFlash`
- `clearUploadQueue`

Comments in `intents.ts` describe them as "State updates produced by services after async IDB work." Plausible refactor, but **STATE.md is the source of truth for the intent catalog** and is out of date. Either STATE.md needs updating to list them, or they should be re-cast as a private "engine-internal" dispatch surface (e.g. a separate `applyChange()` method) so the public catalog stays as documented.

### P3.5.2 — Decision E referenced but undefined
STATE.md references "decision E" twice (lines 27, 76) without ever defining a `## Decision E` heading. Already flagged in Part 1 §1.3 against the docs themselves; in the codebase, `appState.ts:31` and `intents.ts:248–251` both implement the focus-by-id invariant. The code is correct; the doc is incomplete. Drift in the *other* direction (code outpacing docs).

### P3.5.3 — `clearFlash` is reachable by external dispatchers
STATE.md §Flash scheduling: "On timer fire, `flash` is cleared to `null`; the statusline then reverts to whatever the active mode renders." This is the only path for `flash` → `null`.

Implementation exposes `{ type: 'clearFlash' }` as a public `Intent` variant. Any caller (modes, UI, tests) can clear the flash mid-flight, bypassing the timer. STATE.md doesn't authorize that.

### P3.5.4 — `applyPack` / `applySticker` extend dispatch surface for arbitrary writes
Same family as P3.5.1/P3.5.3. The reducer accepts `applySticker` from any caller, which can:
- inject a sticker entity that was never persisted to IDB,
- replace an existing sticker by id without going through `renameSticker`/`setTags`,
- bypass collision resolution entirely.

`PackNewCommand` literally exploits this to "create" a pack without persistence (P2.7 / P3.2.1).

This isn't necessarily wrong — but if these intents are meant to be engine-internal, they should not be part of the publicly-dispatched `Intent` union. STATE.md gives no guidance.

### P3.5.5 — `useObjectURLs` mutates external state during render
STATE.md decision A: "Components never hold derived values in their own state; they recompute from `snapshot` per the table above." Hook compliance: `useObjectURLs(stickers)` returns a `ReadonlyMap<string, string>` — a derived URL cache.

Violator: `src/ui/useObjectURLs.ts:18–36` mutates `cache` (a `useState`-stored Map) during render and calls `URL.createObjectURL` / `URL.revokeObjectURL` as side effects in the render phase. React rules: render must be pure; side effects belong in `useEffect`.

**Effect.** Under React StrictMode (which `main.tsx` enables), every render runs twice. The first pass creates a URL, the second pass sees it in cache and re-uses it — fine for buffers that didn't change. But if a buffer reference changes between the two renders (it shouldn't, but a stale closure could), the cleanup path may revoke a URL the first pass returned but the cleanup function still holds.

Also: the function returns a *new* Map on every call (`new Map([...cache].map(...))` line 43), so the consumer never sees the same Map reference twice — breaks React identity checks if anyone uses the returned Map as a memo dep.

### P3.5.6 — `EngineImpl.dispatch` always allocates a closure in `asEngineHandle`
STATE.md §Decision A: "`getSnapshot()` returns the SAME reference until state changes." Implementation honors that for `getSnapshot`.

But every `transitionTo`/`onEnter`/`onExit`/`handleKey` call creates a *new* engine-handle object (`engine.ts:217–230`):
```ts
return { getSnapshot: () => self.getSnapshot(), dispatch: …, transitionTo: …, … };
```
This isn't a STATE.md violation per se, but if a mode kept a reference to the handle across keystrokes it would notice the handle identity changing on every call. Not a bug, just a small allocation cost.

### P3.5.7 — Engine doesn't centralize the catch boundary
IDB.md decision J: "The engine is the single catch boundary and converts every thrown error into a `E: <message>` flash; nothing throws past the engine."

Implementation: only the service-handler methods (`handleYankFocused`, `handleDeleteFocused`, `handleRenameFocused`, `handleSetTags`, `handleAssignPacks`, `handleSaveUpload`) wrap their service calls in `.catch(err => setFlash(...))`. But there are other paths that can throw:
- `reduce()` throws (e.g. unknown intent if TS exhaustiveness breaks at runtime) — not caught.
- `mode.handleKey(...)` is called from `EngineStore.handleKey` (`engine.ts:194–198`) with no try/catch — a mode that violates the TOTAL-input LSP contract would throw uncaught up to the DOM event listener.
- `mode.statusline(...)` / `mode.overlay(...)` called from `getStatuslineModel` / `getOverlayModel` with no try/catch — same.

**Effect.** A buggy mode crashes the app. The engine is not in fact the "single catch boundary" decision J promises.

---

## P3.6 — Errors against IDB.md (multiplicity rules)

(Distinct from §P3.3 — these are subtle.)

### P3.6.1 — `IdbDatabase.tx` re-fetches even for `readonly` tx
The pre-fetch phase runs `getAll` on every listed store. For a readonly tx whose purpose is just `getAll`, this is correct — the body then iterates `scope.view.stickers.values()`. But the pre-fetch and the body are in the same readonly tx, so the implementation is doing two redundant reads (one in the prefetch, one in the body). Functionally OK; double-cost.

### P3.6.2 — `IdbDatabase` is constructed lazily (`init()` deferred)
IDB.md `init()` is documented to "open DB v1, request persistence." Implementation matches. But `db.tx(…)` throws "call init() before tx()" if invoked first. The composition root calls `db.init()` in `initAsync()` (`composition.ts:58`), so production is fine. But there is no mechanism to *await* init from inside `tx()` — if any code (e.g. a service called from a useEffect before initAsync resolves) hits `tx()` early, it throws.

Not a contract violation, but the engine's intent dispatcher fires off `loadAll` *after* the await in `initAsync` resolves, so the ordering is safe by construction at the cost of being subtle.

---

## P3.7 — Errors against COMPLETED_TASKS.md

### P3.7.1 — M7 "every command is total and atomic"
M7 acceptance: "every command is total (returns Ok|Err, never throws) and atomic (no half-applied state on failure)."

- `PackNewCommand`/`PackRenameCommand`/`PackDeleteCommand` are total (don't throw) and trivially atomic (don't fail), but their *intended* behavior — persisting to IDB — isn't done. So they're "atomic" only because they never attempt the operation that could partially fail.
- `ExportCommand`/`ImportCommand` are total but no-op stubs.

This is doc-vs-implementation drift: the milestone is marked complete in CLAUDE.md ("All milestones are complete"), but the M7 acceptance for these commands is unmet.

### P3.7.2 — M8 services are unreachable from the command layer
M8 acceptance: "all foreign async runs before opening a tx, then one tx per operation; ArrayBuffer↔Blob conversions occur in the service layer per IDB.md boundary; failures surface as `E: <message>` flashes (decision J)."

The services exist (`yankService`, `packService`, `exportService`, `importService`) and meet the transaction discipline. But:
- `ExportService.exportStickers` and `ImportService.importZip` are not wired to `ExportCommand`/`ImportCommand` (P2.13). The services are reachable only from tests.
- `PackService.createPack`/`renamePack`/`deletePack` are not wired to `PackNewCommand`/`PackRenameCommand`/`PackDeleteCommand` (P2.7).

So M8 is "complete" in the sense that the services exist; not in the sense that the user can invoke them.

### P3.7.3 — M9 "contract test suite" missing
M9 acceptance: "each adapter passes the same port contract-test suite the fakes passed (LSP substitutability proven)."

There is no *shared* contract test suite. `src/test/infra.test.ts` tests IDB adapters; `src/test/engine.test.ts` tests engine behavior under fakes. They do not share a test definition, so "the fake and the real adapter pass the same suite" is not demonstrated. This is the literal mechanism LSP macro-decision #1 calls "proven."

### P3.7.4 — M12 KeyboardCapture should pass actual grid column count
M12 acceptance: "KeyboardCapture normalizes DOM events to `KeyEvent` (MODES.md) and forwards to the engine."

Normalization is fine. But the comment in `normalMode.ts:105` admits: "cols=1: correct for sequential traversal at M5. M12 (KeyboardCapture) will pass the actual rendered grid-column count for true 2-D up/down." M12 never wired this. So `j`/`k` are functionally identical to `l`/`h` — broken 2-D nav. Already in Part 2 P2.5.

### P3.7.5 — M13 "no derived value held in component state"
M13 acceptance: "no derived value is held in component state."

Components mostly honor this — derived values (visible grid, focus index, pack counts) are recomputed inline. **But**:
- `useObjectURLs` holds a `Map` of derived URLs as `useState` (`useObjectURLs.ts:16`). Technically the URLs are computed from `Sticker[]`, so they're derived. The Map is held to avoid recomputing `createObjectURL`. Borderline — a cache for expensive operations isn't quite the "derived state" M13 warns about, but it's not "recomputed from snapshot each render" either.

### P3.7.6 — M15 "thumbnails revoked on close (MODES.md UPLOAD exit)"
MODES.md UPLOAD onExit table: "clears uploadQueue, revokes thumbnail object URLs."

Implementation splits this:
- `uploadMode.onExit` clears the queue (P3.4.8).
- `UploadModal` component revokes URLs in `useEffect` cleanup when it unmounts.

The unmount happens when `engine.getOverlayModel().type !== 'UPLOAD'`, which is *after* the mode transition, *after* the queue clear, *after* the React render. So in the right order, revocation happens. But:
- The comment in `uploadMode.ts:60` admits this delegation: "Thumbnail object URL revocation is handled by the UI overlay (M15) because URL.revokeObjectURL is a browser global that must not be called from app/**." Reasonable architecturally.
- BUT: if `UploadModal` is unmounted without going through `onExit` (e.g. the React tree is torn down some other way), the queue still holds candidate references whose URLs may already have been revoked. The two halves of "clear queue + revoke URLs" are split across modules with no joint owner.

### P3.7.7 — M16 "two-column keys/commands"
M16 acceptance: "two-column keys/commands, themed via CSS vars."

`HelpModal.tsx` is a **one-column** list of grouped key bindings. No command palette entries at all. Already in Part 2 P2.8.

### P3.7.8 — M17 "Database.init() runs at startup"
OK. `composition.initAsync()` calls `db.init()` first, then `loadAll`. Note that `initAsync()` is invoked in `main.tsx` *after* the React tree mounts, so the AppRoot renders briefly with `stickers: []`. This causes the "No stickers" empty state to flash before data loads — minor UX defect, not a contract violation.

---

## P3.8 — Errors against SPEC.md not already covered in Part 2

(Most SPEC violations are in Part 2 P2; this subsection picks up SPEC-doc rules that come up only in implementation.)

### P3.8.1 — `Statusline.tsx` left-label always uses `inherit` color
SPEC §Statusline says nothing about colored mode labels; MODES.md decision C only mentions "left-most label, uppercased." The CSS file defines `--mode-normal` through `--mode-help` accent colors but `Statusline.tsx` never consumes them — `color: isError ? 'var(--text-error)' : 'inherit'`. Either drop the dead vars or wire them in.

### P3.8.2 — Statusline `hint` and `right` are merged into one slot
MODES.md decision C lists `hint` and `right` as separate optional fields. Implementation collapses them: `Statusline.tsx:18` uses `model.right ?? model.hint ?? null`. The fields are mutually exclusive across documented modes (CONFIRM uses `hint`, others use `right`), so the collapse is observationally equivalent — but the implementation has *forgotten* that they're conceptually different fields. If a future mode needs both (`right` summary + `hint` prompt), this code can't render them.

### P3.8.3 — `Statusline.tsx` does not implement the mode-label uppercasing
MODES.md decision C: "left-most label, uppercased." Implementation: `Statusline.tsx:14` uses `model.mode` directly. Mode names *happen* to already be uppercase (`'NORMAL'`, `'SEARCH'`, …) so the omission has no visible effect — but the contract is the renderer's responsibility per decision C, not the mode's. Brittle: if a ModeName is ever added in mixed case, the renderer would silently render it un-uppercased.

---

## P3.9 — Errors against CLAUDE.md

### P3.9.1 — CLAUDE.md says "no Tailwind hardcoded colors (all via `var(--*)`)"
Violator: P3.1.7 — `UploadModal.tsx:285` hardcodes `#000`.

### P3.9.2 — CLAUDE.md says "Run `npm run check` after any change"
Not a code defect, but worth noting: there is no CI configuration in `.github/workflows` or similar that runs `npm run check`. Enforcement depends on developer discipline. CLAUDE.md treats it as a hard rule; the repo has no automation backing the rule.

### P3.9.3 — CLAUDE.md says "tests live in `src/test/engine.test.ts`"
Actually two test files exist: `engine.test.ts` AND `infra.test.ts`. CLAUDE.md is slightly out of date.

---

## P3.10 — Cross-cutting bugs (not tied to one doc)

### P3.10.1 — `KeyboardCapture` double-prevents in NORMAL
NormalMode itself calls `evt.preventDefault()` (line 70). `KeyboardCapture` also calls `domEvt.preventDefault()` for NORMAL non-modifier keys (line 35). Double preventDefault is harmless but wasteful — and signals two layers each claiming responsibility for the same invariant.

### P3.10.2 — `composition.ts` `downloadFallback` doesn't append extension
The fallback for yank constructs a `<a download={name}>` using the sticker's raw name. SPEC §Clipboard example shows `pepe.gif` — implying the extension is included. Currently a sticker named `pepe` downloads as `pepe` (no extension), making the OS unable to recognize the format.

### P3.10.3 — `setTimeout` callback in `composition.downloadFallback` is racy
```ts
setTimeout(() => URL.revokeObjectURL(url), 100);
```
The 100ms guess is racy — slow networks or background tabs may not have fetched the blob yet. Better: revoke on the next macrotask after `a.click()` returns *and* listen for window blur/focus (or just `revokeObjectURL` after `setTimeout(…, 0)` since `download` typically queues the fetch immediately).

### P3.10.4 — `useObjectURLs` returns a new Map every call
`useObjectURLs.ts:43`: `return new Map([...cache].map(([id, { url }]) => [id, url]))`. Means consumers that depend on identity (e.g. as a memo dep) re-run every render even when nothing changed. Either return `cache` directly (after revoking removed entries), or compute a stable map only when contents change.

### P3.10.5 — UploadModal listens to `window` paste for the whole modal lifetime
`UploadModal.tsx:144–161` registers a `paste` listener on `window`. If anything outside the modal pastes, the handler still fires. The `if (items.length === 0) return` early-exit means non-image pastes are silently ignored. Reasonable, but the listener also calls `e.preventDefault()` only when an image is found — meaning a paste of text into a focused field still works. OK in practice, but the global listener is broader than needed.

### P3.10.6 — `UploadModal` queue rows use `defaultValue` + `onChange`
Each `<input defaultValue={row.name} onChange={handleNameChange} />` is *uncontrolled*. If the queue is re-ordered or a row's name is patched programmatically, the input does NOT update — the DOM input retains its initial value. This is a real bug if `editQueueRow` is ever dispatched from outside the row itself (e.g. an auto-name-resolver). Currently no caller does, but the door is open.

### P3.10.7 — `Sidebar.tsx` re-creates `SidebarSelection` instances every render
`Sidebar.tsx:19–22` constructs new `AllSelection`, `PackSelection`, `UngroupedSelection` per render. The reducer `setSelection` then receives a fresh instance and stores it. Since selection equality elsewhere is by `.key`, this is observationally OK. But it means `state.selection !== prevState.selection` on every selection click (new identity), which forces every consumer that compares `selection` by reference to invalidate. Minor allocation cost; non-bug.

### P3.10.8 — `Sidebar.tsx` re-computes pack counts on every render
The `rows` array filters `stickers` for each pack: `stickers.filter(s => s.packIds.includes(sel.id)).length`. With N stickers and P packs, this is O(N × P). Fine for small N; quadratic for large. STATE.md "stored vs derived" lists "Pack count (per row)" as derived. Implementation is conforming but unoptimized — acceptable.

### P3.10.9 — `Grid.tsx` "No stickers" message uses CSS but no `()` parens
SPEC says `(no stickers)`. Implementation says `No stickers` (P2.3). Already in Part 2.

### P3.10.10 — Reducer `cycleSelection` always rebuilds the options list
`intents.ts:109–120` rebuilds `[All, …packs, Ungrouped]` on every cycle. Each PackSelection is a new instance. Harmless but again allocation-heavy.

### P3.10.11 — `engine.ts handleSaveUpload` clears the queue but doesn't transition out of UPLOAD
The actual transition happens in `UploadMode.handleKey`'s `Enter` branch (calls `engine.dispatch({type:'saveUpload'})` then `engine.transitionTo('NORMAL')` synchronously). `handleSaveUpload` runs async, so by the time it resolves the mode is already NORMAL and the queue clearance is racing with the next user action. The resolved promise then dispatches `clearUploadQueue` against an already-empty queue — no harm but smelly.

If `Enter` is pressed twice quickly, the first save might not have committed before the second `Enter` dispatches another `saveUpload` — the second call would re-save the (already empty) queue. Currently it's empty by then, so nothing happens. But a re-save with new candidates added between would race.

### P3.10.12 — `NormalMode` `0` digit handling vs SPEC `0` keybinding
`normalMode.ts:76`: bare `0` is dropped as a "standalone 0 is a no-op" to avoid the digit buffer thinking the user typed `0p`. SPEC says `0` jumps to first in current row. Implementation can't satisfy both with the current single-keystroke handling — needs a small delay (like `gg`) to disambiguate. Already noted in P2.5.

### P3.10.13 — `Mode` types in mode files declare `name` as a literal type but use `as const` differently
e.g. `normalMode.ts:37`: `readonly name = 'NORMAL' as const;` — uses literal type narrowing. All modes do this consistently. No issue, just noting that the `Mode` interface (`mode.ts:51`) types `name: ModeName` (the union), so the literal narrowing isn't actually exploited anywhere.

### P3.10.14 — `intents.ts loadAll` rebuilds visible grid using a partially-mutated state
`intents.ts:73–80`:
```ts
const grid = computeVisibleGridFrom(intent.stickers, state);
const focusId = ... grid[0]?.id ?? null;
return { ...state, stickers: intent.stickers, packs: intent.packs, focusId };
```
`computeVisibleGridFrom` makes a fresh `state` with the new `stickers` but the *old* `packs`. If the new stickers reference pack ids that aren't in the *old* packs, the grid is still computed from the new stickers — fine because `selection.matches` for `AllSelection` ignores packs and the default selection is `All`. But if the persisted theme were set to a non-All selection (it isn't per decision D, but if it were), this could mis-compute. Defensive code would compute against the fully-new state.

### P3.10.15 — Reducer never reduces `transitionMode` to clear `uploadQueue` on entering NORMAL
Cross-mode invariant from MODES.md UPLOAD onExit: queue cleared. Engine relies on the mode's `onExit` doing the clear (via `removeQueueRow` loop, P3.4.8). If the engine ever calls `transitionMode` directly (bypassing `transitionTo`), the queue would survive into NORMAL. Currently no such call exists, so fine, but the invariant is held by convention, not by the reducer.

---

## P3.11 — Summary of distinct error count

By doc, deduplicated:

- ARCHITECTURE.md violations: **9** (P3.1.1–P3.1.9)
- DOMAIN.md violations: **4** (P3.2.1–P3.2.4)
- IDB.md violations: **9** (P3.3.1–P3.3.7, P3.6.1–P3.6.2)
- MODES.md violations: **9** (P3.4.1–P3.4.9)
- STATE.md violations: **7** (P3.5.1–P3.5.7)
- COMPLETED_TASKS.md acceptance unmet: **8** (P3.7.1–P3.7.8)
- SPEC.md gaps not in Part 2: **3** (P3.8.1–P3.8.3)
- CLAUDE.md guidance unmet: **3** (P3.9.1–P3.9.3)
- Cross-cutting bugs: **15** (P3.10.1–P3.10.15)

Total distinct items: **67**.

Several entries cross-reference Part 2 (where the same code defect breaks a
SPEC requirement). Items unique to Part 3 — i.e. doc-vs-implementation
drift that isn't a SPEC gap — are the architectural / contract / LSP issues
that need attention even if SPEC compliance were never the goal.

