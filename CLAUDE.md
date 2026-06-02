# CLAUDE.md

## Docs file map

Read the doc(s) listed for your task before writing any code.

| File | Authoritative for |
|---|---|
| `docs/TASKS.md` | Ordered build milestones, global ordering gates (G1, G2) |
| `docs/ARCHITECTURE.md` | Directory structure, layer boundaries, import rules, composition root, LSP macro-decisions |
| `docs/DOMAIN.md` | Entity shapes, SupportedMime, pure substitutable contracts (selection, sort, command, candidate, naming, search) |
| `docs/IDB.md` | Port interfaces, IDB schema, transaction discipline, ArrayBuffer/Blob boundary, fake contract |
| `docs/MODES.md` | Mode FSM contract, engine handle, single-active-mode invariant, per-mode enter/exit, input buffer, statusline model |
| `docs/STATE.md` | AppState snapshot shape, intent catalog, derived values, flash scheduling, persistence decision |

## Global ordering gates

- **G1.** No UI task (M11+) starts until the IDB layer (M2–M3) and the AppState shape (M4) are complete.
- **G2.** No mode task (M6+) starts until the Mode interface and the engine shell (M5) exist.
- Build strictly in numeric order; a task's acceptance must pass before the next.

## Module dependency rules

| Module group | MAY import | MUST NOT import |
|---|---|---|
| `domain/**` | other `domain/**` only | `app`, `infra`, `ui`, any browser global |
| `app/ports/**` | `domain/**` (entity types) | `infra`, `app/engine`, `app/modes`, `ui` |
| `app/{engine,modes,commands,services,upload}/**` | `domain/**`, `app/ports/**` | `infra/**`, `ui/**`, browser globals |
| `infra/**` | `domain/**`, `app/ports/**` | `app/{engine,modes,commands,services}`, `ui` |
| `ui/**` | `app` engine surface + `domain/**` types for rendering | `infra/**` directly |
| `bootstrap/composition.ts` | everything (it is the wiring) | — |
| `test/fakes/**` | `domain/**`, `app/ports/**` | `infra/**` |

Browser globals (`indexedDB`, `navigator`, `localStorage`, `crypto`) may be referenced **only** inside the matching `infra/**` adapter, never elsewhere.

## Composition root rule

`bootstrap/composition.ts` is the *sole* instantiation site for infra adapters and the only module that may reference browser globals. No other module may `new` an adapter or read `indexedDB`, `navigator`, `localStorage`, or `crypto`. This is the enforcement mechanism for LSP macro-decision #1: substituting real infra for `test/fakes/**` is a one-line change at the root.

## LSP macro-decisions (binding; these shaped the whole tree)

1. **Ports-and-adapters exists *because* of LSP.** All Application code is written against the port interfaces in IDB.md, never against infra. The IDB adapter and the in-memory test fake are *subtypes* of those ports and must be drop-in interchangeable — the engine code is byte-identical under either. A fake that weakened any postcondition (e.g. swallowed a missing-key error) would break the substitution and is forbidden.

2. **The Mode FSM is a single substitution site.** The keydown path is `currentMode.handleKey(evt, engine)`. Correctness must never depend on *which* mode is active. This forces the one total `Mode` contract in MODES.md and makes it the FSM's spine, not a bolt-on.

3. **The selection axis is split from the entity axis** to avoid the LSP violation the spec invites (the `(ungrouped)` virtual pack). The substitutable view type `SidebarSelection` (DOMAIN.md) carries only label + count + predicate; mutation lives only on the real `Pack` entity. Never reunite them.

4. **Keep every supertype narrow.** Across the codebase: find the behavior that is *genuinely* common and make only that the supertype; never widen a base type with an operation some subtype cannot honor. Violations show up as `if (x.isSpecial)` guards — treat any such guard on a substitutable type as a design defect.

## Diagnostics

Run `npm run check` after any change. It runs all three checks in sequence and stops on first failure.

| Command | What it checks |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | Type errors, including `verbatimModuleSyntax` violations |
| `npm run lint` | ESLint — style, unused vars, React rules |
| `npm run build` | Full Vite bundle — catches tree-shaking and import errors missed above |

## Milestone completion checklist

Before marking any milestone done, run `npm run check` and confirm it passes, then run tests.

1. `npm run check` — must exit clean (types + lint + build)
2. `npm test` — all tests must pass

## Tests

Run: `npm test` (once) or `npm run test:watch`.

All tests live in `src/test/engine.test.ts`. They exercise the engine + Mode FSM
using the fakes in `src/test/fakes/` — no DOM, no UI.

When adding a test that needs to observe mode lifecycle calls (`onEnter`/`onExit`),
inject a custom registry via the second arg of `EngineImpl`:

```ts
const engine = new EngineImpl({ kv: new FakeKeyValueStore() }, myRegistry);
```

`IModeRegistry` (exported from `app/engine/engine.ts`) is the interface to satisfy —
any object with `get(name: ModeName): Mode | null` qualifies.

**Do not merge `vitest.config.ts` into `vite.config.ts`.** The project's Vite 8
depends on rolldown, which requires Node 20. `vitest.config.ts` imports only from
`vitest/config` (Vite 5 bundle) so tests run on Node 18.

## Reading reminder

When starting any task, read the docs listed for that task before writing any code.
