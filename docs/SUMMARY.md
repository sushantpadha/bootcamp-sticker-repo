# SUMMARY — "What actually works today"

Practical "how to use the current implementation" guide, derived from the code
(not the spec). Anything the spec promises that isn't here is broken or
unwired — see REVIEW.md for the full gap list.

## Adding stickers

1. Press **`a`** — opens the upload modal.
2. Get images into the queue (any of):
   - **Drop** PNG/GIF/WebP files onto the dashed box.
   - **Click** the dashed box → file picker (multi-select).
   - **Ctrl+V** while the modal is open → paste an image from clipboard.
3. For each queued row, edit the **Name** / **Tags** (comma-separated) / **Pack** inputs. In the Pack field, **Tab** completes against existing pack names.
4. Click **ADD ALL** or press **Enter** → saves to IDB; modal closes.
5. **Esc** closes without saving.

⚠️ APNG files won't enqueue (filter rejects `image/apng`). PNG/GIF/WebP only.

## Navigating the grid

| Key | Action |
|---|---|
| `h` / `l` / Arrow ←/→ | left / right |
| `j` / `k` / Arrow ↑/↓ | "down" / "up" — but **cols is hardcoded to 1**, so these effectively step one cell, not one row |
| `gg` (within 500ms) | first sticker |
| `G` | last sticker |
| Click a cell | focus it |

## Sidebar / packs

| Key | Action |
|---|---|
| `Tab` / `Ctrl+N` | next pack (All → packs → Ungrouped → All) |
| `Shift+Tab` / `Ctrl+P` | previous pack |
| `[n]p` (digits then `p`) | cycle **N steps forward** (not "jump to Nth" as spec says) |
| bare `p` | opens PACKASSIGN mode (statusline input — note: `m` is **not** bound) |
| Click a sidebar row | select it |

## Actions on focused sticker

| Key | Action |
|---|---|
| `y` (single) | yank — copies to clipboard, falls back to download if browser refuses (no success flash) |
| `r` | RENAME (statusline input; Enter saves, Esc cancels) |
| `t` | TAGS (comma-separated; Enter saves) |
| `d` | CONFIRM delete (`y`/`n`/`Esc`) |
| bare `p` | PACKASSIGN (edit comma-separated pack names; Enter resolves/creates packs) |

## Search & command palette

- **`/`** — SEARCH mode. Live filter on name + tags. Enter accepts, Esc reverts to whatever was active before.
- **`:`** — COMMAND mode. Enter runs; Esc cancels. No `Tab` autocomplete.
- **`?`** — HELP modal (`q` / Esc closes).

### Commands that actually work today

```
:sort recent      :sort added      :sort name
:theme dark       :theme light
:help
:pack new <name>          ⚠ in-memory only — lost on reload (id is "tmp-<timestamp>")
:pack rename <name>       ⚠ in-memory only
:pack delete              ⚠ in-memory only; does NOT strip the pack id from affected stickers
:tags add <tag>           ← note plural path; SPEC says singular `:tag add`
:tags remove <tag>        ← same
:tags clear               ← not in spec, but registered
```

### Commands that look like they work but don't

```
:export      → registered, but the command is a no-op stub (returns ok:true and does nothing)
:import      → same — no file picker, no ZIP read, nothing
:theme toggle → unknown theme error (only "dark"/"light" are handled)
```

### Commands that don't exist at all

`:pack move`, `:tag rename` (global rename), and the singular `:tag …` forms from spec.

## Things that look bound but do nothing

- **`f`** (toggle favourite) — `toggleFavourite` intent dispatches but the reducer no-ops it and there's no engine/service handler. No tag added, no flash, nothing.
- **`Enter` for yank** — not bound; only `y`.
- **`yy`** (vim-style) — not implemented; single `y` yanks.
- **`n` / `N`** for search-match nav — not bound (`Ctrl+N` is repurposed for pack cycling).
- **`0` / `$`** for row start/end — `0` is swallowed by the digit accumulator.
- **`ctrl+t`** for theme toggle — not bound.

## Persistence reality

- Stickers added via the upload modal **do** persist (the upload pipeline calls `ImportService.saveUpload` which writes one IDB tx).
- Tags edited via `t` or `:tags add/remove` **do** persist.
- Renames via `r` **do** persist.
- PACKASSIGN via `p` **does** persist (creates new packs as needed and writes the sticker).
- Pack creation via `:pack new` **does NOT** persist — refresh and the pack is gone.
- Theme **does** persist (localStorage).

## TL;DR happiest path

`a` → drop a PNG → Enter → navigate with `h/l` (or click) → `y` to copy → `t` to add tags → `p` to assign to packs → `/foo` to search → `?` to see (partial) help. Stay away from `:pack`, `:export`, `:import`, `:theme toggle`, and `f` until those are wired.
