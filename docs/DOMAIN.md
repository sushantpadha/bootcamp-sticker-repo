# DOMAIN

Authoritative for: entity shapes, the supported-mime values, and the pure
substitutable contracts (selection, sort, command, candidate, naming, search).
All types here are framework- and browser-free.

## Entities

interface Sticker {
  id: string;             // crypto.randomUUID()
  name: string;
  packIds: string[];      // a sticker may belong to multiple packs; [] = ungrouped
  tags: string[];
  data: ArrayBuffer;      // raw image bytes — NEVER a Blob (see IDB.md boundary)
  mimeType: SupportedMime;
  createdAt: number;      // Date.now()
  lastUsedAt: number;     // Date.now()
}

interface Pack {
  id: string;             // crypto.randomUUID() — a real, persisted id
  name: string;
  createdAt: number;
}

Invariant: a `Pack` always has a persisted UUID `id`. This invariant is the reason
All/Ungrouped are NOT packs (see SidebarSelection below).

## Decision G — SupportedMime

type SupportedMime = 'image/png' | 'image/gif' | 'image/webp';

APNG is stored as `image/png` and rendered via `<img>` like GIF — no separate type.
Extension map for export filenames / downloads: png→`.png`, gif→`.gif`, webp→`.webp`.

## SidebarSelection — the worked LSP example (KEEP INTACT)

The naive model `UngroupedPack extends Pack` violates LSP: Ungrouped/All have no
persisted `id` (breaks the Pack invariant above) and cannot be renamed/deleted, so
`:pack rename` / `:pack delete` would need to reject them — strengthening
preconditions and forcing `if (x.isUngrouped)` guards. Forbidden.

The genuinely common behavior of the three sidebar rows is only: produce a label, a
count, and a predicate selecting which stickers show. That — and nothing more — is
the supertype:

interface SidebarSelection {
  readonly key: string;                  // stable key for focus/restore
                                          // ("all" | "pack:<id>" | "ungrouped")
  label(): string;
  matches(s: Sticker): boolean;          // the grid predicate
  // [LSP] deliberately NO id, rename(), delete(), persist():
  //       not every selection can honor them, so they are NOT in the supertype.
}

Implementations (all substitutable for filtering + display):
- AllSelection      → matches = () => true
- PackSelection(packId) → matches = s => s.packIds.includes(packId)
- UngroupedSelection → matches = s => s.packIds.length === 0

Mutation lives only on the real `Pack` entity. Commands that rename/delete first
verify the active selection IS a `PackSelection`; otherwise they fail with
`E: no pack selected`. The selection/display axis and the entity/persistence axis are
never reunited.

## StickerSort — strategy substitutability

interface StickerSort {
  readonly id: 'recent' | 'added' | 'name';
  compare(a: Sticker, b: Sticker): number;  // [LSP] MUST be a strict weak ordering:
                                              //       total, deterministic, with a stable
                                              //       tie-breaker (by id) so focus-by-id
                                              //       stays stable when sort is swapped
}

Implementations: RecentSort (lastUsedAt desc), AddedSort (createdAt desc),
NameSort (name asc). The tie-breaker is an LSP obligation, not an optimization: an
unstable comparator would break the focus-by-id stability that STATE.md relies on,
even though it would still type-check as a `StickerSort`.

## Command — command-pattern substitutability

interface Command {
  readonly path: readonly string[];                 // e.g. ['pack','new']
  readonly arity: 'none' | 'one' | 'rest';          // for arg parsing + completion
  run(args: string[], engine: Engine): CommandOutcome; // [LSP] TOTAL: returns Ok | Err,
                                                         //       NEVER throws, NEVER partially
                                                         //       mutates then fails (atomic)
}
type CommandOutcome =
  | { ok: true; flash?: string }
  | { ok: false; flash: string };

Atomicity invariant: a command must not leave half-applied state on its failure
path. The runner resolves the longest matching `path`; no match flashes
`E492: Not an editor command: <input>`. Because every command returns a
`CommandOutcome` (never throws), the runner handles all commands identically — that
uniform postcondition is the substitution guarantee. (`Engine` handle: see MODES.md.)

## StickerCandidate — upload-source substitutability

interface StickerCandidate {
  defaultName: string;
  mimeType: SupportedMime;
  thumbnailUrl(): string;                 // object URL for the 48×48 preview
  resolveBytes(): Promise<ArrayBuffer>;   // [LSP] every source resolves to an
                                           //       ArrayBuffer the same way
}

FileCandidate(file) (drop/picker) and ClipboardImageCandidate(blob) (Ctrl+V) are
substitutable; the save pipeline calls `resolveBytes()` for all candidates first,
then writes in one tx (see IDB.md transaction rule). The uploader never branches on
source.

## Decision F — naming collision algorithm contract

resolveNameCollision(name, targetPackIds, existing): string

- Inputs: the proposed `name`, the `targetPackIds` the sticker will belong to
  (`[]` = ungrouped), and `existing` = all other stickers.
- Output: a unique name. If `name` is already free, return it unchanged; otherwise
  append `(2)`, `(3)`, … until free.
- Scoping rule (per-pack): the name must be unique among co-members of *each* pack in
  `targetPackIds`. For `targetPackIds === []`, scope is the set of stickers with
  `packIds.length === 0`. Increment until the name is free in **all** target scopes
  simultaneously.
- Pure and deterministic; no IDB, no clock. Used on rename, on upload save, and on
  import.

## SearchPredicate contract

buildSearchPredicate(query): (s: Sticker) => boolean

- Searches `name` and each entry of `tags`.
- Case-insensitive substring: lowercase both query and field, test inclusion.
- Empty/whitespace-only query → matches everything.
- Returns a predicate over a single Sticker. Composition with the active
  `SidebarSelection` (logical AND) and the resulting match count are STATE.md's
  derived concerns, not this function's.