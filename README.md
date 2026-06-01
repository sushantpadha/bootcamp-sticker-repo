# bootcamp-sticker-repo

A keyboard-driven sticker manager that lives entirely in your browser. No server,
no sync, no account. Your stickers stay in IndexedDB until you export them.

## What it is

- Vim-style keybindings — navigate, yank, tag, and organize without touching the mouse
- Two themes: terminal green on black, or GitHub light (`ctrl+t` to toggle)
- Pack-based organization with multi-pack membership
- ZIP export/import for backup and migration
- Supports PNG, GIF, WebP, APNG

## Running it

```bash
npm install
npm run dev
```

That's it. No backend. Open `http://localhost:5173` and press `a` to add your first sticker.

## Key bindings (quick reference)

| Key | Action |
|-----|--------|
| `h j k l` | left / down / up / right |
| `gg` / `G` | first / last sticker |
| `0` / `$` | first / last in row |
| `p` / `P` | next / previous pack |
| `Enter` / `yy` | copy sticker to clipboard |
| `a` | add stickers |
| `r` | rename |
| `t` | edit tags |
| `m` | assign packs |
| `f` | toggle favourite |
| `d` | delete |
| `/` | search |
| `n` / `N` | next / previous search match |
| `:` | command palette |
| `?` | help |
| `ctrl+t` | toggle theme |

Full keybinding reference: press `?` in the app.

## Commands

```
:pack new <name>        create a pack
:pack rename <name>     rename current pack
:pack delete            delete current pack
:pack move <name>       move focused sticker to pack
:tag add <tag>          add tag to focused sticker
:tag rename <old> <new> rename tag globally
:sort recent|added|name change sort order
:export                 download full DB as ZIP
:import                 restore from ZIP
:theme dark|light|toggle
:help
```

## Architecture

Ports-and-adapters with a vanilla engine (no state library) that React reads via
`useSyncExternalStore`. The domain layer is pure TypeScript with no browser
dependencies. LSP-abiding substitution seams are documented in `docs/`.

```
ui/          → React, rendering only, no business logic
app/         → engine, modes, commands, services
app/ports/   → interfaces (never infra)
infra/       → IDB, clipboard, JSZip adapters
domain/      → pure entities, sort, search, naming
bootstrap/   → sole instantiation site for infra
```

See `docs/ARCHITECTURE.md` for the full model.

## Tech stack

- React 18 + Vite
- Tailwind (layout/spacing only — all colors via CSS custom properties)
- JSZip
- IndexedDB via a hand-rolled ports-and-adapters layer
- No other runtime dependencies