# DECISIONS

Open engineering decisions that surfaced while auditing the codebase against
SPEC.md. None of these are answered by SPEC.md, ARCHITECTURE.md, DOMAIN.md,
IDB.md, MODES.md, STATE.md, or COMPLETED_TASKS.md as of this audit. Each entry
states the question, the options worth considering, and the trade-offs.

> **User answers are recorded in `> **ANSWER:**` blocks under each question.**
> Unanswered items are still open.

---

## 0. Rebuild scope (added during Q&A)

**Question.** How to approach the rebuild — modify in place, scratch rewrite,
or hybrid?

> **ANSWER:** Modify existing code in place. Preserve git history; restructure
> files only when ARCHITECTURE.md explicitly requires it (e.g. `app/upload/`).

---

## 0b. Doc-update strategy (added during Q&A)

**Question.** Update docs to match implementation, or fix code only?

> **ANSWER:** Two-phase process.
> 1. **Phase 1 (docs).** Do **NOT** touch `SPEC.md` — it stays the canonical
>    product source of truth. Update the *other* docs (ARCHITECTURE.md,
>    DOMAIN.md, IDB.md, MODES.md, STATE.md, COMPLETED_TASKS.md) to add
>    everything currently missing from them that SPEC requires (see REVIEW.md
>    Part 1). Goal: every doc is internally consistent with SPEC.
> 2. **Phase 2 (code).** Update src/ to match the now-consistent doc tree.
> 3. After both phases: only `REVIEW.md` and `DECISIONS.md` get further
>    updates; the spec/architecture docs are the source of truth.

The convention: pick an option, then promote the rule into the relevant doc
(STATE.md / MODES.md / IDB.md / etc.) so future work has an authoritative
reference. Do not leave decisions parked here long-term — DECISIONS.md is a
scratchpad, not a contract.

---

## 1. Conflict between SPEC palette and implemented palette

**Question.** SPEC.md prescribes terminal-green-on-black (`#00ff00` on
`#0a0a0a`) for dark and GitHub Light for light. The implementation
(`src/ui/theme/themeVars.css`) uses Tokyo Night for dark and a custom indigo
light theme. Which is authoritative?

**Options.**
- **(a)** Treat SPEC as binding → rip out current palette, rewrite `themeVars.css`
  to match SPEC's nine variables (`--bg`, `--bg-subtle`, `--border`, …)
  exactly, drop the extra namespacing (`--bg-sidebar`, `--mode-search`, …),
  and update every component that consumes the extras.
- **(b)** Treat implementation as the new product direction → update SPEC.md
  to describe the Tokyo-Night-ish palette and the expanded variable set.
- **(c)** Two-layer model → keep the nine SPEC primitives as the source of
  truth and define every other variable as a semantic alias on top
  (`--bg-sidebar: var(--bg-subtle)`, `--mode-search: var(--border-focus)`…).
  Requires reworking the CSS file but keeps SPEC compliance.

**Trade-offs.** (a) is the cleanest but throws away the per-mode color system
and looks like a step backward visually. (b) abandons the SPEC's
"terminal-on-black" aesthetic which is a clear design intent. (c) is the most
work up-front but preserves both SPEC contract and the richer namespace.

> **ANSWER:** (a) Strict SPEC. Rewrite themeVars.css to use only the nine
> SPEC vars (`--bg`, `--bg-subtle`, `--border`, `--border-focus`, `--text`,
> `--text-dim`, `--text-error`, `--highlight-bg`, `--highlight-border`) with
> SPEC's terminal-green/black + GitHub Light values. Update every component
> that reads `--bg-sidebar`/`--mode-*`/etc. to use the nine primitives.

## 2. Mid-stream rebinding of `p` / `m` / `n` in NORMAL

**Question.** Current bindings: `Tab`/`Ctrl+N` cycle packs, bare `p` opens
PACKASSIGN, `m` is unbound, `n` is unbound. SPEC bindings: `p` cycles next pack,
`P` cycles previous, `[n]p` jumps to Nth pack, `m` opens PACKASSIGN, `n`/`N`
cycle search matches. Rebinding will affect any user (including tests) that
learned the current layout.

**Options.**
- **(a)** Adopt SPEC verbatim. Drop `Tab`/`Ctrl+N`/`Ctrl+P` cycling (or keep
  them as undocumented aliases).
- **(b)** Adopt SPEC plus aliases — both `p` and `Tab` cycle, both `m` and
  `p` open PACKASSIGN. Risk: `p` is overloaded with both cycle-and-modal
  meanings, which is exactly what SPEC's `[n]p` is trying to disambiguate
  (digit prefix → cycle; no prefix → cycle by 1).
- **(c)** SPEC is wrong about `[n]p` semantics — current "cycle N steps"
  interpretation is the better one. Update SPEC.

**Trade-offs.** SPEC's `[n]p` says "jump to nth pack (1-indexed)". For users
who memorize pack order, absolute jump (SPEC) is sharper. For users who don't,
relative cycle (current) is friendlier. SPEC is the source of truth, so (a)
should win unless there's an explicit product reason to override.

**Sub-decision needed:** `[n]p` "1-indexed" — does index 1 mean `All`, or the
first real pack? Implies a tie-in with `(ungrouped)`'s position.

> **ANSWER:** SPEC plus aliases (no removals).
> - Bind all SPEC keys: `p`=next pack, `P`=prev pack, `m`=PACKASSIGN, `yy`+`Enter`=yank,
>   `n`/`N`=search nav, `ctrl+t`=theme toggle, `0`/`$`=row start/end, `G`=last sticker.
> - **Keep** `Tab`/`Ctrl+N`/`Shift+Tab`/`Ctrl+P` as aliases for pack cycling.
> - `p` is overloaded: bare `p` cycles forward (SPEC); since `m` opens PACKASSIGN,
>   `p` no longer needs to. Resolves the previous "p does both" tension.
> - `[n]p` sub-decision answered below.
>
> **Sub-answer (`[n]p`):** Absolute jump, index 1 = first real pack. So `1p`
> selects the first user-created pack; `2p` the second; etc. `All` and
> `(ungrouped)` reached only via cyclic `p`/`P`. Out-of-range digits clamp to
> the last pack (no error flash).

## 3. `j` / `k` 2-D navigation — where does column count live?

**Question.** `NormalMode.handleKey` dispatches `moveFocusDir` with `cols: 1`
(hardcoded), so `j`/`k` step by one cell instead of one row. The actual column
count depends on viewport width and the grid's `auto-fill, 96px` template,
which only the UI knows.

**Options.**
- **(a)** UI measures the grid (ResizeObserver / `getBoundingClientRect` on the
  grid container ÷ cell width) and the engine reads it. Means engine needs a
  new "current cols" piece of state OR `KeyboardCapture` reads from a ref and
  rewrites incoming key events to dispatch with the real `cols`.
- **(b)** Engine owns column count; UI publishes it via a new intent
  (`setGridCols`) on resize. Cleanest data flow, slight overhead on resize.
- **(c)** Compute cols at dispatch time from a UI-supplied resize event
  channel; never store cols in AppState.
- **(d)** Drop 2-D semantics entirely — `j`/`k` step by one (current behavior).
  SPEC ambiguity: spec says "left / down / up / right" without defining
  "down" as "one row" vs "one cell".

**Trade-offs.** (a) and (b) require engine ↔ UI coupling for a value that
changes only on resize. (d) is the smallest change but breaks vim parity for
anyone used to grid 2-D nav. (b) keeps the unidirectional flow.

> **ANSWER:** (b) UI publishes cols via intent on resize.
> - Add `gridCols: number` to AppState (default 1).
> - Add `setGridCols` intent.
> - `Grid.tsx` uses ResizeObserver on its container; dispatches `setGridCols`
>   whenever the column count changes.
> - NormalMode reads `state.gridCols` from snapshot when dispatching
>   `moveFocusDir`; KeyboardCapture no longer needs to know about cols.
> - Row-edge wrap: `h` at col 0 wraps to last col of previous row; `l` at last
>   col wraps to first col of next row (SPEC §Edge Cases).

## 4. Skip-by-id on import without UUIDs in storage that match

**Question.** SPEC: "For each sticker: skip if `id` already in IDB." The current
ImportService **generates new UUIDs** instead of preserving the manifest's id.
There's no path for "this is the same sticker I exported yesterday."

**Options.**
- **(a)** Preserve manifest ids verbatim. Use them on insert; on conflict
  (existing id in IDB), skip the row. This is what SPEC says.
- **(b)** Hash-based dedup: derive an id from the image bytes (e.g. SHA-256 of
  ArrayBuffer); skip if duplicate. More robust against id collisions across
  databases but adds compute cost on import.
- **(c)** Hybrid: prefer manifest id, fall back to byte-hash if manifest
  predates id stability.

**Trade-offs.** (a) is the simplest and matches SPEC. (b) handles
cross-database moves better but requires hashing every imported sticker. (a) is
probably right unless we have a real cross-DB merge use case.

**Implication for `:pack delete` + re-import:** if a user deletes a pack and
re-imports the same zip, (a) re-creates the pack only if its id isn't in IDB.
That's fine if delete is permanent, weird if it isn't.

> **ANSWER:** (a) Preserve manifest ids; skip on existing id.
> - ImportService reads `manifest.json`, iterates packs and stickers.
> - For each: `if (existingIds.has(entry.id)) skip; else insert with entry.id`.
> - Return `{ stickersImported, packsImported, stickersSkipped, packsSkipped }`
>   so the flash can read `imported: N stickers, M packs (K skipped)`
>   (K = stickersSkipped + packsSkipped).

## 5. Persistence of `selection`, `sort`, `search`?

**Question.** STATE.md decision D says only `theme` persists. SPEC doesn't
contradict but doesn't address it either. UX question: do users want their last
sort / pack filter / search remembered across reloads?

**Options.**
- **(a)** Leave it: only theme persists. Reload always starts in All / Recent
  / no-search. Simpler and matches STATE.md.
- **(b)** Also persist `sort` (cheap, useful) but not `search` (transient).
- **(c)** Persist all three. Maximum convenience; minor risk that user
  reopens to a confusing filtered view.

**Trade-offs.** (a) is the documented decision; only revisit if there's a
clear user complaint. If we change this, update STATE.md decision D and add
the keys to `KeyValueStore`.

> **ANSWER:** (a) Only theme persists. Keep STATE.md decision D as-is. Reload
> resets selection=All, sort=Recent, search="".

## 6. APNG handling: client-side normalization or pass-through?

**Question.** SPEC accepts APNG; DOMAIN.md decision G stores APNG as
`image/png` mime. Browsers report APNG as either `image/png` or `image/apng`
depending on source (file picker vs clipboard vs drag-drop). The implementation
filters by mime, so `image/apng` is rejected.

**Options.**
- **(a)** Treat `image/apng` as `image/png` at the boundary (UploadModal +
  any other mime-filter): accept and rewrite to `image/png` before
  enqueuing. Aligns with decision G.
- **(b)** Add `image/apng` to `SupportedMime` as a fourth case. Forces
  `.png` extension mapping anyway. Adds one branch.
- **(c)** Reject APNG (current behavior). Contradicts SPEC.

**Trade-offs.** (a) is the cheapest fix and stays inside the existing
SupportedMime type. (b) wastes a type variant.

> **ANSWER:** (a) Accept `image/apng`; rewrite to `image/png` at the upload
> boundary (UploadModal `isSupportedMime` accepts apng; FileStickerCandidate
> stores `mimeType: 'image/png'` for apng inputs). `<input accept>` includes
> `image/apng` so the picker shows them. SupportedMime stays a 3-variant union.

## 7. Yank: success vs failure flash text — exact wording

**Question.** SPEC examples are `yanked: pepe.gif` (with extension) and
`(no clipboard: downloading)`. The download fallback uses the sticker's
`name` without extension. Should the yank flash include the extension or just
the name?

**Options.**
- **(a)** `yanked: <name>` (no extension). Matches the `<name>` placeholder in
  SPEC §Clipboard ("flash `yanked: <name>`"). But SPEC §Statusline example
  shows `yanked: pepe.gif` — `.gif` is part of the example's name.
- **(b)** `yanked: <name>.<ext>` (always include extension derived from mime).
  Matches the example literally.
- **(c)** Use whichever the sticker has — if the user named it `pepe.gif`,
  show that; if `pepe`, show that. Consistent with the stored name.

**Trade-offs.** (c) is least surprising (what you see is what you stored). (b)
adds an extension the user may not have asked for. Recommend (c) unless we
also decide that sticker names always carry their extension at storage time
(probably not — names are user-facing labels, extension is mime-derived).

> **ANSWER:** (b) Always append mime extension (via DOMAIN.md decision-G map).
> Flash text: `yanked: ${name}${mimeExtension[mime]}` — e.g. a sticker named
> `pepe` with mime `image/gif` flashes `yanked: pepe.gif`.
> Same extension-append applied to the download fallback's `<a download>`
> attribute (so `pepe` downloads as `pepe.gif`).

## 8. PACKASSIGN tab-complete in statusline — completion source and ranking

**Question.** UploadModal's queue row implements tab-complete against
existing pack names with `startsWith` matching. PACKASSIGN statusline mode
needs the same logic but in a different control surface.

**Options.**
- **(a)** Extract a shared `completePackToken(input, packNames): string |
  null` helper in `domain/` (or `app/upload/`) and use it from both UI
  (UploadModal) and `packAssignMode.handleKey`. Simplest.
- **(b)** Add a token-completion port (`PackCompletionPort`) and inject. Pure
  but overkill for one pure-function helper.
- **(c)** Inline the same logic in both places. Smallest diff, biggest drift
  risk.

**Trade-offs.** (a) is the standard answer. Helper lives in `domain/naming/`
or `app/upload/`. If we ever extend completion (e.g. to fuzzy match), the
helper has one obvious home.

**Sub-decision:** matching style. `startsWith` (current), `includes`,
case-insensitive, or full fuzzy. Recommend case-insensitive `startsWith` to
match existing UploadModal behavior.

> **ANSWER:** (a) Extract pure helper in `src/domain/naming/completeToken.ts`.
> Signature: `completeToken(input: string, candidates: string[]): string` —
> returns the new input string with the current token (last comma-separated
> token, or the whole string if no commas) replaced by the first candidate that
> case-insensitively starts with the token (and isn't equal to it). If no
> match, returns `input` unchanged.
> Used by:
> - PACKASSIGN statusline mode (statusInput, candidates = state.packs.map(p => p.name))
> - UploadModal queue row's Pack input (DOM value, same candidates)
> - COMMAND mode's first-token Tab autocomplete (Q-cmdtab below) — same helper
>   with candidates = command paths' first tokens.

## 9. Empty-grid + action key — silent no-op vs explicit error flash

**Question.** SPEC §Edge Cases: "If grid is empty and user presses any action
key (`d`, `r`, `t`, `m`, `yy`): do nothing silently." Currently NormalMode
transitions to RENAME/TAGS/CONFIRM even when there's no focused sticker; the
modes then prefill empty input. SPEC says "silently."

**Options.**
- **(a)** Guard in NormalMode: each action key checks
  `state.focusId === null` first; if so, return without dispatching/
  transitioning. Centralizes the rule in the key dispatch layer.
- **(b)** Guard in each mode's onEnter: if no focus, immediately re-transition
  back to NORMAL. Distributes the rule across modes.
- **(c)** Guard in the engine: `transitionTo` checks the mode's "requires
  focus" flag (Mode interface extension). Adds metadata to Mode contract.

**Trade-offs.** (a) is the smallest change and keeps the rule in one place,
but enumerates which keys need guarding. (b) is more decentralized but each
mode's onEnter becomes conditional. (c) is the most principled but widens the
Mode supertype, which conflicts with LSP decision #4 ("Keep every supertype
narrow"). Recommend (a).

> **ANSWER:** (a) Guard in NormalMode.handleKey.
> - Keys `d`, `r`, `t`, `m`, `y` (yy), `Enter` (yank), `f` (favourite),
>   and `:tags add/remove` commands check focus first.
> - If `state.focusId === null`, return without dispatching/transitioning.
> - No flash, no error — silent no-op per SPEC.
> - This rule does NOT apply to navigation keys (`h/j/k/l/G/0/$/gg`),
>   `/`, `:`, `?`, `a`, `p`/`P`/`Tab`/`[n]p`, or `ctrl+t`.

## 10. FlashScheduler vs Clock port

**Question.** STATE.md says flash is `Clock`-driven. `flash.ts` uses
`setTimeout` directly. If we honor STATE.md, we need a `Clock` capable of
scheduling future callbacks, not just `now()`.

**Options.**
- **(a)** Widen `Clock` to `Clock { now(): number; setTimeout(cb, ms):
  Token; clearTimeout(token): void }`. Most direct. Real impl wraps
  `globalThis.setTimeout`; fake can advance time deterministically.
- **(b)** Introduce a separate `Timer` port. Keeps `Clock` narrow.
- **(c)** Leave it as `setTimeout`; update STATE.md to drop the "Clock-driven"
  claim. Cheapest, but loses the testability win.

**Trade-offs.** (b) is the cleanest LSP-friendly answer (Clock stays narrow
per macro-decision #4). (a) bundles concerns. (c) is pragmatic if we don't
need to fake time in tests; given that test/fakes/fakeClock.ts already
exists, we probably do want fakeable timing.

> **ANSWER:** (b) Separate `Timer` port.
> - New file: `src/app/ports/timer.ts`
>   ```
>   interface Timer {
>     setTimeout(cb: () => void, ms: number): TimerHandle;
>     clearTimeout(h: TimerHandle): void;
>   }
>   type TimerHandle = number | object; // opaque
>   ```
> - Real impl: `src/infra/system/systemTimer.ts` (wraps globalThis).
> - Fake impl: `src/test/fakes/fakeTimer.ts` (manual advance for tests).
> - FlashScheduler accepts a Timer in its constructor.
> - NormalMode accepts a Timer (passed via Engine handle or constructor).
> - STATE.md decision "Clock-driven" updated to "Timer-driven" (or both).
> - Composition root wires SystemTimer everywhere.

## 11. Where does "success flash" wiring live?

**Question.** Every action that needs a success flash (`yanked:`, `renamed:`,
`tagged:`, `added:`, `imported:`, `exporting...`) currently has nowhere
obvious to live. Three plausible homes:

**Options.**
- **(a)** Services emit a (text, isError) result alongside their entity
  return; the engine handler reads it and calls `setFlash`. Services own
  copy. Centralizes mapping in services.
- **(b)** Engine handlers know the flash text per intent. Services stay
  copy-free. Centralizes mapping in `engine.ts`.
- **(c)** Modes emit the flash after the intent is dispatched (e.g.,
  RenameMode calls `engine.setFlash('renamed: ' + name, false)` after
  dispatching). Keeps copy at the user-facing seam.

**Trade-offs.** (a) couples services to user-facing strings (bad for i18n
later). (b) keeps services pure but adds switch-statements in engine. (c)
ties copy to the keystroke that triggered it (closest to "user feedback for
this gesture") and keeps the engine slim. Recommend (c) with one exception:
service-failure flashes (the `E: <message>` path) should stay in the engine
where the catch already lives.

> **ANSWER:** (c) Modes/commands emit success copy; engine emits errors.
> - Success flashes raised by the keystroke handler that initiated the action:
>   `yanked:` — NormalMode after dispatching yankFocused (or engine after the
>   async resolves, since yank is async — use the latter for accuracy).
>   `renamed:` — RenameMode after dispatch.
>   `tagged: favourite` / `untagged: favourite` — NormalMode after `f`.
>   `added: N stickers` — UploadMode after Enter (or async resolution).
>   `imported: N stickers, M packs (K skipped)` — ImportCommand after async.
>   `exporting... done: N stickers` — ExportCommand: first flash `exporting...`,
>   then `done: N stickers` after async.
> - Errors (`E: ...`, `E492: ...`) raised by the engine's single catch boundary
>   or by CommandRegistry.run for unknown commands.
> - For async actions (yank, upload save, import, export), engine raises the
>   success flash after the service promise resolves — modes shouldn't flash
>   before the IDB write commits.

## 12. ZIP file naming on download

**Question.** SPEC: `stickerdb-export-<YYYY-MM-DD>.zip`. The export pipeline
needs to trigger a browser download — which layer owns that side-effect?

**Options.**
- **(a)** Add a `Downloader` port (`download(blob: Blob, filename: string):
  void`) implemented in `infra/files/` using the object-URL + anchor +
  click + revoke pattern. Engine calls it from a service result.
- **(b)** Re-use the existing `onDownloadFallback` closure from
  `composition.ts`. Currently used for the yank fallback. Awkward to share
  because the function lives in the closure, not as a typed port.
- **(c)** Inline in the `ExportCommand` once wired (commands have access to
  Engine which can take a Downloader from ports).

**Trade-offs.** (a) is the principled answer (a side-effect deserves a
port). (b) saves code but conflates two unrelated triggers. Recommend (a):
promote `onDownloadFallback` into a real `Downloader` port and route both
yank-fallback and export-download through it.

> **ANSWER:** (b) Reuse the existing `onDownloadFallback` closure pattern.
> - Rename it conceptually to a generic `downloadBlob(blob, filename)` closure
>   defined in `composition.ts`.
> - Wire it into both YankService (for clipboard-write-failure fallback) and
>   ExportCommand (for the export download trigger).
> - ExportCommand builds the filename `stickerdb-export-${YYYY-MM-DD}.zip`
>   using the injected Clock to format today's date (UTC).
> - Yank's fallback uses `${sticker.name}${mimeExtension[sticker.mimeType]}`.
> - Do NOT promote to a new Downloader port yet — revisit only if more
>   download triggers appear.

## 13. Truncation algorithm — exact behavior of "X chars + `..`"

**Question.** SPEC: "sticker names 12 chars, pack names in sidebar 14 chars —
truncate with `..`". Three obvious interpretations:

**Options.**
- **(a)** Hard cap at N visible characters: if `name.length > N`, render
  `name.slice(0, N) + '..'` (so a 12-char limit shows up to 14 chars on screen
  for truncated names). Matches a naive reading.
- **(b)** Cap including the suffix: `name.length > N` → render `name.slice(0,
  N - 2) + '..'` (total width = N). More consistent column widths.
- **(c)** Use CSS `text-overflow: ellipsis` (current) and call it a day.
  Easier; visually similar.

**Trade-offs.** (a) and (b) differ by which "12 chars" means. SPEC is
ambiguous. (c) drops the `..` literal — it's `…` (one char) — and varies by
font. Recommend (b): consistent column widths. State the rule explicitly in
ARCHITECTURE.md or a new VISUALS.md.

> **ANSWER:** (a) Hard cap at N visible chars. Algorithm:
> ```
> function truncate(s: string, maxChars: number): string {
>   return s.length > maxChars ? s.slice(0, maxChars) + '..' : s;
> }
> ```
> - Sticker name in grid cell: `truncate(name, 12)` → up to 14 chars on screen.
> - Pack name in sidebar row: `truncate(name, 14)` → up to 16 chars on screen.
> - Rule documented in ARCHITECTURE.md (new "Visual constants" section)
>   during Phase 1 doc updates.

## 14. `:tag rename <old> <new>` — atomicity and case-sensitivity

**Question.** SPEC: "rename tag globally across all stickers." Two sub-decisions:

**Sub-question A — atomicity.** All stickers updated in one tx or one per
sticker?
- **(a)** Single tx (load all, rewrite affected, put all back). Atomic;
  matches IDB.md tx discipline.
- **(b)** One tx per sticker. Smaller tx scope but breaks atomicity.

Recommend (a).

**Sub-question B — case-sensitivity.** Should `:tag rename Foo bar` match
stickers tagged `foo`?
- **(a)** Case-sensitive exact match (treat `Foo` and `foo` as distinct).
- **(b)** Case-insensitive match (rename both `Foo` and `foo` to `bar`).
- **(c)** Match exactly as stored. Tags are user-input, so the user knows the
  case.

Recommend (a) / (c): exact match. Tag store is case-sensitive; let the user
handle case ambiguity explicitly.

> **ANSWER:** Single tx, case-sensitive exact match.
> - New service method `TagService.renameTagGlobally(oldName, newName)`:
>   1. Load all stickers into memory (outside tx).
>   2. For each sticker with `tags.includes(oldName)`: replace with `newName`,
>      dedup the resulting array.
>   3. Single readwrite tx: put all affected stickers.
> - If `oldName === newName`: no-op, success flash.
> - Flash on success: `renamed tag "old" → "new" (N stickers)`.
> - Error flash `E: <message>` on failure.

## 14b. Tag command paths (added during Q&A)

**Question.** SPEC singular vs current plural; drop or keep `:tags clear`.

> **ANSWER:** Keep both singular and plural. Concretely:
> - Register `:tag add`, `:tag remove`, `:tag rename` (SPEC-compliant primary).
> - Also register `:tags add`, `:tags remove`, `:tags rename` as aliases
>   pointing to the same command implementations.
> - Keep `:tags clear` (and add `:tag clear` alias) as a documented extra.
> - Help modal lists the SPEC singular form; users discover aliases via
>   tab-complete.

---

## 15. `:pack move <name>` — semantics on a focused sticker that's already in the pack

**Question.** SPEC: "add focused sticker to named pack (create if not
exists)." If sticker already has `packId` in its `packIds`, what happens?

**Options.**
- **(a)** No-op + success flash (`already in pack "foo"`).
- **(b)** No-op silently.
- **(c)** Treat as toggle (remove). Bad UX — conflicts with the "add" verb.

Recommend (a). Make the success vs no-op distinction visible.

> **ANSWER:** (a) No-op + informative flash.
> - If sticker already has packId for "foo": no IDB write, flash
>   `already in pack "foo"`.
> - If sticker not in pack and pack exists: add packId, single tx, flash
>   `moved to pack "foo"`.
> - If pack doesn't exist: create pack + add packId in single tx, flash
>   `moved to pack "foo" (created)`.
> - Error: `E: <message>`.

## 15b. Layer restructure to match ARCHITECTURE.md (added during Q&A)

> **ANSWER:** Full restructure.
> - Create `src/app/upload/` directory.
> - Move `src/domain/values/stickerCandidate.ts` → `src/app/upload/stickerCandidate.ts`.
> - Extract `FileStickerCandidate` from `UploadModal.tsx` →
>   `src/app/upload/fileCandidate.ts`.
> - Extract `ClipboardStickerCandidate` from `UploadModal.tsx` →
>   `src/app/upload/clipboardCandidate.ts`.
> - Move `QueuedSticker` from `src/app/engine/appState.ts` →
>   `src/app/upload/uploadQueue.ts` (re-export from appState if needed).
> - Add factories to entities:
>   - `src/domain/entities/sticker.ts`: `createSticker(input): Sticker`
>     (generates id is the responsibility of the caller? or accept IdGenerator?
>     — for pure domain, accept all fields including id; caller wires UUID).
>   - `src/domain/entities/pack.ts`: `createPack(input): Pack` (same shape).
> - These two layer moves are the ONLY ARCHITECTURE-driven restructures;
>   everything else stays in place.

---

## 16. Theme variable migration strategy

**Question.** If decision #1 picks option (a) or (c), the rename touches every
component file. Should we do it in one PR or in stages?

**Options.**
- **(a)** Big-bang: one PR that renames every variable, updates every consumer.
  Easier to review as a single coordinated rename.
- **(b)** Add SPEC variables alongside existing ones, migrate consumers one
  area at a time, finally remove the unused vars.
- **(c)** Compatibility shim in CSS only: `--bg-sidebar: var(--bg-subtle);`
  etc. No component changes; consumers keep their current var names while
  SPEC vars become the canonical source.

**Trade-offs.** (a) is high-blast-radius but ends in a clean state. (b) is
incremental but leaves the tree in an inconsistent middle state for as long as
the migration takes. (c) gets SPEC compliance immediately with zero component
diff — but every var ends up with two names, and someone has to remember to
audit consumers later. Recommend (c) for a fast SPEC-compliance win followed
by gradual consumer cleanup if/when motivated.

> **ANSWER:** (a) Big-bang one-pass rewrite.
> - `themeVars.css` rewritten to only contain the nine SPEC vars +
>   `--overlay-bg` (decision 22).
> - Every consumer file (`AppRoot.tsx`, `Grid.tsx`, `StickerCell.tsx`,
>   `Sidebar.tsx`, `PackRow.tsx`, `Statusline.tsx`, `HelpModal.tsx`,
>   `UploadModal.tsx`) updated in the same pass to use the new names.
> - Mapping (non-SPEC → SPEC):
>   - `--bg-sidebar`, `--bg-grid` → `--bg`
>   - `--bg-statusline`, `--bg-cell`, `--bg-input` → `--bg` or `--bg-subtle` (case-by-case)
>   - `--bg-cell-focus`, `--bg-cell-hover`, `--bg-selection` → `--highlight-bg`
>   - `--border-focus`, `--border-active` → `--border-focus`
>   - `--mode-*`, `--accent`, `--accent-bg`, `--accent-dim` → `--text`
>     or `--border-focus` (mode-label colors removed entirely)
>   - `--text-bright`, `--text-hint`, `--text-muted`, `--text-warn`,
>     `--text-ok` → `--text` or `--text-dim`
>   - `--bg-overlay-panel` → `--bg`
>   - `--sep`, `--scrollbar-*` → deleted (scrollbars hidden per SPEC)
> - Hardcoded `#000` in UploadModal also replaced.

## 16b. IdbDatabase single-tx fix (added during Q&A)

> **ANSWER:** Single tx; reads + writes share the same IDB transaction.
> - Open ONE `db.transaction(stores, mode)` at tx() start.
> - TxScope holds the IDBTransaction handle. Repository `getAll`/`get` issue
>   IDB requests on that tx and synchronously populate the scope's `view`
>   maps on first read (lazy prefetch within the same tx).
> - Repository `put`/`delete` issue requests on the same tx; commit happens
>   when the tx completes.
> - Body runs synchronously between request issuance; foreign awaits inside
>   body kill the tx the same way the real IDB tx auto-closes.
> - FakeDatabase already does this; the real adapter aligns with it.
> - Document: the prefetch-then-write pattern is removed.

---

## 17. Visual overlay for HELP — partial vs full coverage

**Question.** SPEC: "Overlays the sticker grid (sidebar and statusline remain
visible)." Current `HelpModal` covers the whole viewport. Easy fix — but does
the `?` keypress feel right if the sidebar/statusline are still
clickable/visible underneath?

**Options.**
- **(a)** Follow SPEC strictly: HelpModal sized like UploadModal (`top:0;
  left:180; bottom:28`). Sidebar still clickable while HELP is open.
- **(b)** Full-viewport but dim sidebar/statusline visually (less interactive
  affordance). Closer to current.
- **(c)** Make HELP a true "modal" — full viewport, ignore sidebar clicks
  while open. (HelpMode already eats all keys, so the keyboard side is fine;
  the question is just the mouse side.)

Recommend (a) — matches SPEC + matches UploadModal pattern.

> **ANSWER:** (a) Grid-only overlay.
> - HelpModal positioned `top:0; left:180px; bottom:28px; right:0` (matches
>   UploadModal).
> - Two-column layout: NORMAL mode keys on left, command palette on right.
> - All keybindings and all commands listed (mirror SPEC tables verbatim).
> - Semi-transparent backdrop using `--bg` with opacity (or SPEC's overlay var
>   if added during Phase 1).
> - `q` / `Esc` close (already handled by HelpMode).

## 17b. SEARCH Esc behavior (added during Q&A)

> **ANSWER:** Strict SPEC.
> - SEARCH `Esc` dispatches `setSearch('')` then transitions to NORMAL.
> - SEARCH `Enter` transitions to NORMAL leaving `state.search` as-is
>   (the live filter committed by ongoing keystrokes).
> - Remove the `searchOnEnter` mode-internal field — no mode-internal state
>   beyond what MODES.md decision H sanctions (NormalMode gg/digit buffers only).
> - Pack filter (selection) is preserved across SEARCH exit (already correct).

---

## 18. Where do flash strings live for i18n-readiness?

**Question.** Adopting decision #11 (modes emit copy) plants user-facing
strings across many files. If we ever want to translate the UI, we'll need to
collect them.

**Options.**
- **(a)** Define a `FLASH` constants module
  (`src/ui/strings/flashStrings.ts` or `src/app/engine/flashStrings.ts`)
  exporting builders (`yanked(name) => 'yanked: ' + name`). Modes import.
- **(b)** Inline string literals at call sites; rely on `grep` if we ever
  need to extract.

**Trade-offs.** (a) costs a small module and one extra import per usage but
makes future translation work trivial. (b) is faster today and matches the
existing "no abstractions until needed" guidance. Probably (b) for now;
reconsider if/when localization is on the roadmap.

> **ANSWER:** (b) Inline literals.
> - Use template literals at call sites: e.g. `engine.setFlash(\`yanked: ${name}${ext}\`, false)`.
> - No strings module.
> - If i18n becomes a need later, a `grep -rE "setFlash\\(\`" src/` reveals
>   every call site for extraction.

---

## 19. Internal intents visibility (added during Q&A)

> **ANSWER:** Make them engine-internal.
> - Public `Intent` union (exported from `intents.ts`) only contains the
>   20 STATE.md intents (`loadAll`, `moveFocus`, `setSelection`, etc.).
> - `moveFocusDir` stays public (it's the actual move; `moveFocus(id)` is a
>   distinct primitive — both are needed; STATE.md just glosses them as
>   `moveFocus(dir|target)`).
> - Engine-internal types (`applySticker`, `applyStickers`, `removeSticker`,
>   `applyPack`, `removePack`, `clearFlash`, `clearUploadQueue`) move to a
>   private `EngineInternalChange` union inside `engine.ts`; engine has a
>   private `_applyChange(change)` that reduces those, separate from the
>   public `dispatch(intent)`.
> - `flash` becomes public (modes/services emit it), `clearFlash` becomes
>   internal (only the timer fires it).
> - STATE.md decision is updated: "the Intent union is exactly the catalog
>   below; engine-internal updates use a separate channel."

---

## 20. Hover styling: scale + tooltip (added during Q&A)

**Question.** SPEC §Layout: grid cell hover applies `transform: scale(1.15)`,
z-index raised, tooltip with full name + tags + pack names. Current code only
swaps background. Implement?

> **ANSWER:** Implement scale + raised z-index + tooltip (full SPEC).
> - `:hover` → `transform: scale(1.15); z-index: 10` (cell sits above neighbors).
> - Custom tooltip `<div>` positioned absolutely below the cell on hover,
>   showing:
>   ```
>   <full name>
>   tags: tag1, tag2, …  (omit line if no tags)
>   packs: packA, packB, …  (omit line if ungrouped)
>   ```
> - Tooltip uses themed CSS vars; appears with no delay (or 200ms delay if
>   feels too eager — implementer's call).
> - Native `title` attribute also set as a fallback for accessibility.

---

## 21. Favourite tag literal (added during Q&A)

**Question.** SPEC: `f` toggles tag `favourite`. Case-sensitive? Lowercase
literal only?

> **ANSWER:** Case-sensitive exact match on the literal `favourite`.
> - `handleToggleFavourite` checks `sticker.tags.includes('favourite')` exactly.
> - If present: remove it, flash `untagged: favourite`.
> - If absent: append it, flash `tagged: favourite`.
> - Single IDB tx; no collision logic needed.
> - Constant defined in `src/domain/values/favouriteTag.ts` to avoid
>   stringly-typed literals: `export const FAVOURITE_TAG = 'favourite';`.

---

## 22. Overlay backdrop rgba (added during Q&A)

**Question.** SPEC §Upload Modal: `rgba(0,0,0,0.7)` for dark / `rgba(255,255,255,0.7)`
for light. Current uses single `--bg-overlay` var with non-spec rgba. Match SPEC
exactly?

> **ANSWER:** Strict SPEC rgba.
> - Add `--overlay-bg` to `themeVars.css`:
>   - `.theme-dark { --overlay-bg: rgba(0, 0, 0, 0.7); }`
>   - `.theme-light { --overlay-bg: rgba(255, 255, 255, 0.7); }`
> - `UploadModal` and `HelpModal` both use `background: var(--overlay-bg)`.
> - This is the ONLY CSS var allowed outside the SPEC nine (since SPEC's nine
>   don't include an overlay color). It's added as a tenth, documented in
>   ARCHITECTURE.md visual-constants section during Phase 1.

---

## 23. Tests (added during Q&A)

**Question.** Existing tests (`engine.test.ts` 1335 lines, `infra.test.ts`
226 lines) were written against current implementation. After the rebuild
many will fail. Keep + fix one by one, rewrite, or delete?

> **ANSWER:** Keep + fix incrementally.
> - Do not delete tests up-front.
> - After each major rebuild step (palette, keybindings, commands, services,
>   modes, intents refactor, ARCHITECTURE restructure), re-run `npm test` and
>   fix breakages.
> - Add new tests for newly-implemented behaviors:
>   - `f` toggleFavourite end-to-end (intent → service → tag mutation → flash)
>   - `:export` / `:import` (using FakeZipCodec + FakeDownloader stub)
>   - SEARCH `Esc` clears search
>   - PACKASSIGN tab-complete (using completeToken helper directly)
>   - Empty-grid action keys are no-ops
>   - Grid focus wrap at row edges
>   - `[n]p` absolute jump
>   - Timer port: flash auto-clears after 2s of fake-time advance
>   - IdbDatabase single-tx behavior (no race window)
> - Final acceptance: `npm test` passes 100%.

---

## 24. Verification at the end (added during Q&A)

**Question.** After implementation, should I run `npm install`, then
`npm run check` (tsc + lint + build) and `npm test`, then commit?

> **ANSWER:** Install + check + test, do NOT commit.
> - End-of-rebuild sequence:
>   1. `npm install` (if `node_modules` is missing).
>   2. `npm run check` — must exit clean (tsc + lint + build).
>   3. `npm test` — all tests must pass.
> - Leave all changes staged (or unstaged). User reviews diff manually before
>   any commit / PR is made.
> - If `npm run check` or `npm test` fail, fix and re-run before declaring done.
> - Report any leftover failures clearly with file:line refs.

---

## 25. preventDefault scope per mode (added during Q&A)

**Question.** Which modes should swallow default browser shortcuts?

> **ANSWER:** Only NORMAL preventDefault (SPEC-literal).
> - NormalMode keeps calling `evt.preventDefault()` on every non-modifier key.
> - Remove `evt.preventDefault()` from SearchMode/CommandMode/RenameMode/
>   TagsMode/PackAssignMode (currently all call it).
> - For input modes, the engine still routes the key event to the mode, which
>   updates statusInput; browser shortcuts (Ctrl+R, F12, etc.) work normally.
> - Special-case the keys input modes DO want to swallow: `Enter` (so it
>   doesn't submit a form somewhere), `Tab` (so it doesn't change focus),
>   `Escape` — only those.
> - UPLOAD/HELP also only call preventDefault on Enter/Escape; everything else
>   is browser-default. (HELP/UPLOAD overlays don't have focused inputs aside
>   from the upload-modal DOM inputs which handle their own keydown.)
> - KeyboardCapture's NORMAL-specific preventDefault stays (belt-and-braces
>   for the brief window before mode dispatch).

---

## 26. All remaining detail decisions (auto-answered)

User instruction: "answer all remaining questions yourself." These are the
fine-grained calls that didn't warrant a separate question round but still
need to be made before code can be written. Each is justified by an existing
doc (SPEC / ARCHITECTURE / MODES / STATE / IDB / DOMAIN) or by an earlier
answer.

### 26.1 Export filename date format
Use **UTC `YYYY-MM-DD`** via `new Date(clock.now()).toISOString().slice(0, 10)`.
Consistent across timezones; matches SPEC's literal example without ambiguity.

### 26.2 ExportService scope
- Accepts both `stickers: Sticker[]` AND `packs: Pack[]` (currently only stickers).
- Manifest includes `version: 1`, `exportedAt: clock.now()`, `packs: ZipPackEntry[]`, `stickers: ZipManifestEntry[]`.
- ZipManifestEntry uses `file: "stickers/<id>.<ext>"` (SPEC field name; rename from current `filename`).
- Files inside zip actually placed at `stickers/<id>.<ext>` (not zip root).
- Returns `Blob`; ExportCommand triggers the download via reused `downloadBlob` closure with filename `stickerdb-export-${YYYY-MM-DD}.zip`.
- Flashes: `exporting...` (immediately on dispatch), `done: N stickers` (after async resolves).

### 26.3 JsZipCodec changes
- `pack()`: place each file at `stickers/<id>.<ext>` per `entry.file`; `manifest.json` at zip root.
- `unpack()`: read manifest, then read each file via `entry.file` path (not assume root).
- Throws `Error('Invalid zip: missing manifest.json')` and `Error('Invalid zip: missing file ' + path)` on malformed input (existing behavior preserved).

### 26.4 ImportService skip-by-id
- Open one tx: `db.tx(['stickers','packs'], 'readwrite', scope => {...})`.
- Inside tx: collect existing ids via `stickers.getAll(scope)` / `packs.getAll(scope)` into Sets.
- For each manifest pack: skip if `existingPackIds.has(entry.id)`, else `packs.put(scope, entry)`.
- For each manifest sticker: skip if `existingStickerIds.has(entry.id)`, else `stickers.put(scope, {...entry, data: files.get(entry.file)})`.
- Return `{ stickersImported, packsImported, stickersSkipped, packsSkipped }`.
- Flash: `imported: ${stickersImported} stickers, ${packsImported} packs (${stickersSkipped + packsSkipped} skipped)`.

### 26.5 KeyboardCapture cols handoff
- Reads `snapshot.gridCols` from the current snapshot when constructing the KeyEvent.
- Does NOT inject cols into the event itself; NormalMode pulls `state.gridCols` from `engine.getSnapshot()` when dispatching `moveFocusDir`.
- Grid.tsx publishes via ResizeObserver → `dispatch({type: 'setGridCols', cols})`.

### 26.6 Sidebar header
- Render `PACKS [N]` at the top, where `N = stickers.length` (total count, not filtered).
- Use the SPEC truncation rule for pack rows: `truncate(name, 14)` + `..`.
- Active row prefix: `> ` (2 chars including space); inactive prefix: `  ` (2 spaces) to keep alignment in monospace.
- Each row: `${prefix}${truncate(name, 14)} [${count}]`.
- All/Pack/Ungrouped all use this format.

### 26.7 Grid empty states
Two distinct empty messages:
- If `stickers.length === 0` (DB-empty): centered hint `press a to add your first sticker` in `var(--text-dim)`.
- If `stickers.length > 0` but visible grid is empty (filter excludes all): centered `(no stickers)` in `var(--text-dim)`.

### 26.8 useObjectURLs side-effects in render
- Move all URL creation/revocation into `useEffect` with `[stickers]` dep.
- Cache stored in `useRef` (not useState; we don't render on cache mutation).
- Return value: the cache Map directly (stable reference across renders unless cleared).
- React StrictMode double-render: effects rerun cleanup→setup, so any object URL created in setup is revoked in cleanup; recreated on the second setup. Correct.

### 26.9 CommandMode `Tab` autocomplete
- First-token completion only (per SPEC §Command Palette).
- Candidates = unique first-tokens of registered command paths: `pack`, `tag`, `tags`, `sort`, `theme`, `help`, `export`, `import`.
- Uses the `completeToken(input, candidates)` helper from §8.
- Only completes if input has no space yet (first-token position). After space, Tab is a no-op (subcommand completion is out of scope for SPEC).

### 26.10 CommandMode `Backspace` on empty buffer
- Remove the extra-exit-to-NORMAL behavior. Backspace on empty buffer is a no-op (consistent with all other input modes).

### 26.11 ConfirmMode no-focus fallback
- Unreachable after §9's empty-grid guard. Remove the `[y/n]` fallback branch and the no-focus pending=null branch. ConfirmMode always has a pending action when entered.

### 26.12 Statusline rendering
- Always uppercase the mode label (`model.mode.toUpperCase()`) defensively.
- Keep `hint` and `right` as separate `StatuslineModel` fields. Renderer shows `right` if present, else `hint`; never both at once (current modes never set both).
- Drop all per-mode color vars (`--mode-normal`, etc.). Mode label uses `var(--text)` always; flash error uses `var(--text-error)`.
- Style: `font-weight: 600`, `padding-right: 8px` for left label; `white-space: nowrap`; `overflow: hidden; text-overflow: ellipsis` for input segment.

### 26.13 Single catch boundary widening
Engine wraps these additional call sites to honor IDB.md decision J:
- `mode.handleKey(evt, handle)` in `handleKey`.
- `mode.statusline(handle)` in `getStatuslineModel`.
- `mode.overlay(handle)` in `getOverlayModel`.
- `reduce(state, intent)` in `dispatch`.
Each catch path: `setFlash('E: ' + errorMessage(err), true)`. Reset to a safe default if mid-transition state can't be salvaged (e.g. force transition back to NORMAL).

### 26.14 Drag-over visual feedback on drop zone
- Track local `useState(dragOver)`.
- On `onDragOver` set true; on `onDragLeave`/`onDrop` set false.
- When `dragOver`: border becomes `var(--border-focus)` (highlight color), background `var(--highlight-bg)`.

### 26.15 Sticker name truncation in grid cell
- Use `truncate(name, 12)` (per §13).
- Color: `var(--text-dim)`.
- Tooltip on hover shows full untruncated name (per §20).

### 26.16 Pack name truncation in PACKASSIGN/PACKASSIGN-completion
- The statusline input shows raw text (no truncation; user is editing).
- Tab-completion uses the full pack name even if it would visually overflow the statusline — the input scrolls horizontally per browser default.

### 26.17 `transitionMode` notify suppression in `transitionTo`
- `transitionTo` runs `current.onExit → set modeName → next.onEnter` as today.
- To honor MODES.md's "atomic" claim from React's view: wrap the three steps in a `batchUpdates` flag that suppresses `notify()` until the transition completes. Subscribers see exactly one snapshot after the transition (mode changed + onEnter side-effects applied).
- Implementation: `EngineImpl.batching = true` around the three steps; `notify()` skips while true; one explicit `notify()` after.

### 26.18 `transitionTo` no-target-mode error
- Replace the "mode not yet implemented" flash with `throw new Error(...)` (since all 9 modes are registered).
- The widened catch boundary (§26.13) converts to `E: ...` flash automatically.

### 26.19 IdbRepository error onerror handler
- Remove the `.onerror = () => {}` assignment from put/delete (`idbStickerRepository.ts`, `idbPackRepository.ts`). Default behavior bubbles to tx abort. Comment explains why no handler is needed.

### 26.20 `:pack delete` confirmation
- No extra CONFIRM mode. User typed the command literally; that's confirmation enough.
- Sticker delete via `d` keeps using CONFIRM mode (one keystroke is too easy to hit accidentally; SPEC requires the y/n prompt).

### 26.21 Flash on `:pack` commands
- `:pack new <name>` → `pack "name" created` on success.
- `:pack rename <name>` → `pack renamed to "name"`.
- `:pack delete` → `pack "name" deleted (M stickers updated)` where M = count of affected stickers.
- `:pack move <name>` → per §15.

### 26.22 Flash on `:sort` commands
- `:sort recent` → `sort: recent` (success flash).
- Same pattern for `added`, `name`.

### 26.23 Flash on `:theme` commands
- `:theme dark` / `:theme light` / `:theme toggle` → `theme: dark` or `theme: light` (whichever was applied).

### 26.24 Flash on `f` favourite toggle
- After add: `tagged: favourite`.
- After remove: `untagged: favourite`.

### 26.25 Flash on `:tag add/remove/rename`
- `:tag add foo` → `tagged: foo` (success).
- `:tag remove foo` → `untagged: foo`.
- `:tag rename old new` → `renamed tag "old" → "new" (N stickers)` per §14.

### 26.26 Flash on `r` rename
- After successful rename (with possible `(2)` suffix): `renamed: <resolved-name>`.

### 26.27 Flash on `t` tags edit
- No specific success flash in SPEC. Use silent no-flash (the visible tag change is its own confirmation).

### 26.28 Flash on `m` PACKASSIGN
- No specific success flash in SPEC. Silent.

### 26.29 Flash on yank
- Success: `yanked: ${name}${mimeExtension[mime]}` (per §7).
- Clipboard fail / download fallback: `(no clipboard: downloading)`.
- Other error: `E: ${error.message}`.

### 26.30 Flash on `a` upload save
- Success: `added: ${N} stickers`.
- Error: `E: ${error.message}`.

### 26.31 Flash on `d` delete (after y confirmation)
- No specific success flash in SPEC. Silent (sticker disappears from grid; that's the confirmation).

### 26.32 Flash on import
- `imported: ${stickersImported} stickers, ${packsImported} packs (${stickersSkipped + packsSkipped} skipped)` per §4.

### 26.33 Flash on export
- `exporting...` immediately.
- `done: ${N} stickers` after async resolves.

### 26.34 Pre-existing tests on `tags add`/`tags remove`/`tags clear`
- Will pass after rebuild because `:tags ...` paths are kept as aliases (per §14b).
- Update test imports to use new helper names if any were renamed.

### 26.35 Mode-internal state cleanup
- SearchMode: remove `searchOnEnter` (per §17b).
- ConfirmMode: keep `pending` (sanctioned by MODES.md per-mode table).
- NormalMode: keep `gg`/digit buffers (decision H), now backed by Timer port (§10).
- No other mode-internal state allowed.

### 26.36 Public Intent surface (final)
Public Intent union after refactor (exactly these 19):
`loadAll, moveFocus, moveFocusDir, setSelection, cycleSelection, setSort, setSearch, yankFocused, enqueueCandidates, editQueueRow, removeQueueRow, saveUpload, deleteFocused, renameFocused, setTags, assignPacks, toggleFavourite, setTheme, setStatusInput, flash, transitionMode, setGridCols`.
(That's 22 with the new additions. Engine-internal changes — `applySticker`, `applyStickers`, `removeSticker`, `applyPack`, `removePack`, `clearFlash`, `clearUploadQueue` — go through a separate private channel per §19.)

### 26.37 Composition-root one-line swap restoration
Group adapter construction so swapping in fakes IS one line of edits per port:
```ts
const isReal = true;
const db        = isReal ? new IdbDatabase() : new FakeDatabase();
const stickers  = isReal ? new IdbStickerRepository() : new FakeStickerRepository();
// ...
```
Or wrap in a `buildInfra(): EnginePorts` function with an explicit `kind: 'real' | 'fake'` arg. Doesn't matter which; document the pattern in composition.ts so M10's "one line" claim holds.

### 26.38 Date.now() removal
Remove all `Date.now()` calls from `src/app` and `src/domain`. Use the injected `Clock` everywhere. Specifically: `packCommands.ts` PackNewCommand. The PackService.createPack is already correct.

### 26.39 setTimeout/clearTimeout removal
Remove all `setTimeout`/`clearTimeout` calls from `src/app`. Use the injected `Timer` port. Affected files: `flash.ts`, `normalMode.ts`.

### 26.40 `clearUploadQueue` intent usage
Replace the per-row `removeQueueRow` loop in `UploadMode.onExit` with a single internal `_clearUploadQueue` change.

### 26.41 Re-flash after async save
On `saveUpload`'s async resolution, dispatch the success flash with the result count (not pre-emptively in the mode).

### 26.42 Edge: `:pack new` for an existing name
- If pack with that name already exists: flash `E: pack "${name}" already exists` and do nothing.
- Pack names are unique by user expectation (sidebar shows them once).

### 26.43 Edge: `:pack rename` to same name
- If new name equals current name: no-op + success flash `renamed to "${name}"` (idempotent).
- If new name matches another pack's name: flash `E: pack "${newname}" already exists` and abort.

### 26.44 Pack name collision in PACKASSIGN find-or-create
- If a name in the PACKASSIGN input collides with an existing pack name: use the existing pack (don't create a new one with the same name).
- Already handled in PackService.assignPacks; preserve.

### 26.45 PackService.assignPacks `_allStickers` argument
- Wire it through: call `resolveNameCollision(sticker.name, newPackIds, allStickers)` and use the resolved name for the sticker's rename if collision detected. Per DOMAIN.md decision F.
- Updated sticker carries possibly-renamed `name` field.

### 26.46 Theme toggle implementation
- `:theme toggle` reads `state.theme`, dispatches `setTheme: theme === 'dark' ? 'light' : 'dark'`.
- `ctrl+t` in NormalMode does the same.

### 26.47 Statusline mode-label uppercasing
- Apply `.toUpperCase()` in Statusline.tsx defensively. Mode names already uppercase; the toUpperCase is contract-honoring noise.

### 26.48 Implementation order (deterministic, dependency-safe)

Phase 1 — Doc updates (no code changes):
1. Add missing sections to ARCHITECTURE.md (visual constants, Timer port reference, app/upload/ directory contents).
2. Add `## Decision E — focus-by-id` to STATE.md.
3. Add Timer-port reference to STATE.md Flash scheduling.
4. Update MODES.md keybinding tables to include the missing keys (G, 0, $, n, N, ctrl+t, m, yy, Enter, p as cycle, P, [n]p as absolute jump).
5. Add ZIP archive layout + manifest schema to IDB.md.
6. Update DOMAIN.md to cover :pack move create-if-missing, :tag rename atomicity.
7. Add Flash strings catalog to STATE.md.

Phase 2 — Code (in this order to avoid mid-flight breakage):
1. Domain: add factories (createSticker, createPack); add FAVOURITE_TAG constant; add completeToken helper.
2. Ports: add Timer port (timer.ts).
3. Infra: add SystemTimer; fix IdbDatabase to single-tx; remove .onerror swallowing; add downloadBlob via existing closure pattern.
4. Test fakes: add FakeTimer; update FakeDatabase to enforce `stores` argument and reject foreign awaits.
5. App restructure: create src/app/upload/ with stickerCandidate, fileCandidate, clipboardCandidate, uploadQueue. Update imports across UploadModal, intents, etc.
6. App engine: refactor Intent union (split public/internal); wire Timer into FlashScheduler; add `setGridCols`/`gridCols`; widen catch boundary; batch notifies during transitionTo.
7. App services: fix PackService.assignPacks to use _allStickers; add createPack/deletePack/movePack persistence wiring; fix ExportService (packs in manifest, file: path with stickers/ prefix); fix ImportService (skip-by-id, return skip counts); add TagService.renameTagGlobally; add handleToggleFavourite engine method.
8. App commands: fix paths (singular tag + plural alias); add :pack move; add :tag rename; fix :theme toggle; wire :export/:import to services; success flashes.
9. App modes: NormalMode rebind (yy, Enter, m, p=cycle, P, [n]p=absolute, 0, $, n, N, ctrl+t, empty-grid guards); SearchMode strict-SPEC Esc; CommandMode Tab autocomplete; PackAssignMode Tab autocomplete via completeToken; remove preventDefault from input modes (only NORMAL); ConfirmMode no-focus branch removed; UploadMode use _clearUploadQueue.
10. UI theme: rewrite themeVars.css to nine SPEC vars + --overlay-bg; remove hardcoded #000.
11. UI components: update all consumers to use SPEC var names; PackRow with `>` marker + `[count]` brackets + 14-char truncation; Sidebar header `PACKS [N]`; StickerCell with 12-char truncation + scale 1.15 hover + tooltip; Grid with two empty states; useObjectURLs side-effects moved to useEffect.
12. UI modals: HelpModal grid-only overlay + two-column SPEC-mirror; UploadModal accept image/apng; placeholder strings; drag-over visual.
13. UI Statusline: uppercase mode label; drop dead mode-color vars.
14. UI KeyboardCapture: only preventDefault for NORMAL; pass snapshot.gridCols to NormalMode via getSnapshot.
15. Composition root: wire SystemTimer; group adapter construction for one-line fake swap.
16. Tests: re-run; fix breakages by name change / new intents / removed mode-internal state; add new tests for newly-implemented behaviors.

Phase 3 — Verify:
1. `npm install`.
2. `npm run check` (tsc + lint + build) — must exit clean.
3. `npm test` — all tests pass.
4. Report final diff summary; leave staged for user review (no auto-commit).

---

## What to do with this file

1. For each decision: discuss → pick an option → write the chosen rule into
   the *correct* doc (SPEC.md if it changes product behavior, STATE/MODES/IDB
   if it constrains implementation contracts, ARCHITECTURE if it shapes the
   tree).
2. Delete the entry from this file once promoted.
3. If a decision can't be picked yet, leave it here with a `**Status:
   blocked on X**` note so future readers know why.
