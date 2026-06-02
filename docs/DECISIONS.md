# DECISIONS

Open engineering decisions that surfaced while auditing the codebase against
SPEC.md. None of these are answered by SPEC.md, ARCHITECTURE.md, DOMAIN.md,
IDB.md, MODES.md, STATE.md, or COMPLETED_TASKS.md as of this audit. Each entry
states the question, the options worth considering, and the trade-offs.

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

## 15. `:pack move <name>` — semantics on a focused sticker that's already in the pack

**Question.** SPEC: "add focused sticker to named pack (create if not
exists)." If sticker already has `packId` in its `packIds`, what happens?

**Options.**
- **(a)** No-op + success flash (`already in pack "foo"`).
- **(b)** No-op silently.
- **(c)** Treat as toggle (remove). Bad UX — conflicts with the "add" verb.

Recommend (a). Make the success vs no-op distinction visible.

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

---

## What to do with this file

1. For each decision: discuss → pick an option → write the chosen rule into
   the *correct* doc (SPEC.md if it changes product behavior, STATE/MODES/IDB
   if it constrains implementation contracts, ARCHITECTURE if it shapes the
   tree).
2. Delete the entry from this file once promoted.
3. If a decision can't be picked yet, leave it here with a `**Status:
   blocked on X**` note so future readers know why.
