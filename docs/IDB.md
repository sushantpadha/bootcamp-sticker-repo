# IDB

Authoritative for: the persistence ports, the concrete IndexedDB schema, the
transaction discipline, the ArrayBuffer↔Blob boundary, the uniform error surface,
and the fake-implementation contract. Entity field shapes are in DOMAIN.md.

## Port interfaces (verbatim, with LSP annotations)

```
type StoreName = 'stickers' | 'packs';

interface Database {
  // [LSP] The tx body may ONLY issue IDB-request-backed repo calls.
  //       It must NOT await foreign async (arrayBuffer(), zip parsing, fetch...).
  tx<T>(stores: StoreName[], mode: 'readonly' | 'readwrite',
        body: (scope: TxScope) => T): Promise<T>;
  init(): Promise<void>;                  // open DB v1, request persistence
}

interface Repository<E extends { id: string }> {
  getAll(scope: TxScope): E[];            // snapshot into memory (no cursors for views)
  get(scope: TxScope, id: string): E | undefined;
  put(scope: TxScope, entity: E): void;   // write within the provided tx only
  delete(scope: TxScope, id: string): void;
}
interface StickerRepository extends Repository<Sticker> {}
interface PackRepository    extends Repository<Pack> {}

interface ClipboardPort  { write(mime: SupportedMime, blob: Blob): Promise<void>; }
interface FilePickerPort { pickImages(): Promise<File[]>; pickZip(): Promise<File | null>; }
interface ZipCodecPort   { /* pack(manifest, files) -> Blob; unpack(File) -> {manifest, files} */ }
interface KeyValueStore  { get(k: string): string | null; set(k: string, v: string): void; }
interface Clock          { now(): number; }
interface IdGenerator    { uuid(): string; }
interface Timer          {
  setTimeout(cb: () => void, ms: number): TimerHandle;
  clearTimeout(h: TimerHandle): void;
}
type TimerHandle = number | object;     // opaque
```

The `Timer` port replaces direct `setTimeout`/`clearTimeout` use in
`app/engine/flash.ts` and `app/modes/normalMode.ts`. Real impl wraps
globalThis; fake impl advances time deterministically. This is what makes
flash scheduling and gg/digit-buffer timing testable.

LSP obligations across all ports:
- **Uniform error surface (decision J).** Any failure throws. The engine is the
  single catch boundary and converts every thrown error into a `E: <message>` flash;
  nothing throws past the engine. A fake that "succeeds silently" weakens the
  contract and is forbidden — it would not be substitutable for the real adapter.
- **Transaction discipline is a contract, not a convention** (see below).
- `getAll`/`put`/`delete` are valid only inside a provided `TxScope`.

## Concrete IndexedDB schema (implemented by infra/idb)

- DB name `stickerdb`, version `1`.
- Store `stickers`, keyPath `id`. Indexes: `lastUsedAt` (non-unique),
  `createdAt` (non-unique), `packIds` (non-unique, **multiEntry: true**).
- Store `packs`, keyPath `id`. No indexes required.
- On `init()`: open v1, then fire-and-forget `navigator.storage.persist()`.
- Views never use cursors: `getAll()` into memory, sort/filter in JS (see STATE.md
  derived table).

### Single-tx implementation rule

`IdbDatabase.tx(stores, mode, body)` opens **exactly one** IDB transaction (no
prefetch-then-write split). Reads and writes inside `body` go through the same
transaction. Repositories' `getAll`/`get` issue IDB requests against the tx and
synchronously populate a scope-local Map view; `put`/`delete` issue requests
against the same tx; commit happens on tx completion. This matches FakeDatabase
semantics exactly (LSP macro-decision #1).

If the caller lists `stores: ['stickers']` but the body calls a `packs.put`,
the underlying IDB tx throws (real IDB behavior). Both real and fake adapters
preserve this.

## ZIP export / import format

Export ZIP layout:

```
stickerdb-export-<YYYY-MM-DD>.zip   (date is UTC: new Date(clock.now()).toISOString().slice(0, 10))
├── manifest.json
└── stickers/
    ├── <sticker-id>.gif
    ├── <sticker-id>.png
    └── ...                          (extension from DOMAIN.md decision G)
```

`manifest.json` schema:

```ts
interface ExportManifest {
  version: 1;
  exportedAt: number;                  // clock.now() at export time
  packs: Array<{
    id: string;
    name: string;
    createdAt: number;
  }>;
  stickers: Array<{
    id: string;
    name: string;
    packIds: string[];
    tags: string[];
    mimeType: 'image/png' | 'image/gif' | 'image/webp';
    createdAt: number;
    lastUsedAt: number;
    file: string;                      // path inside zip, e.g. "stickers/<id>.gif"
  }>;
}
```

### Import dedup semantics

- For each manifest pack: skip if `existingPackIds.has(entry.id)`, else insert.
- For each manifest sticker: skip if `existingStickerIds.has(entry.id)`, else
  insert with `data: files.get(entry.file)`.
- All packs + stickers inserted in a single readwrite tx.
- Returns `{ stickersImported, packsImported, stickersSkipped, packsSkipped }`
  so the engine can flash `imported: N stickers, M packs (K skipped)` where
  K = stickersSkipped + packsSkipped.

## Transaction discipline — HARD CONSTRAINT

Inside a `Database.tx(...)` body you may issue **only** IDB-request-backed repo
calls. You may never `await` any non-IDB async work inside an open transaction.

Exact violation pattern to avoid:

```
  // FORBIDDEN — awaiting foreign async inside an open tx lets the tx auto-close
  await db.tx(['stickers'], 'readwrite', async (scope) => {
    const buf = await file.arrayBuffer();   // ❌ foreign await; tx is now dead
    repo.put(scope, { ...rec, data: buf });
  });
```

Correct shape — resolve all foreign async first, then open one tx for all writes:

```
  const buffers = await Promise.all(candidates.map(c => c.resolveBytes())); // outside tx
  await db.tx(['stickers', 'packs'], 'readwrite', (scope) => {
    /* only repo.put/delete here */
  });
```

This rule is also what keeps `IdbDatabase` and `FakeDatabase` substitutable: both
honor "one synchronous-ish write phase per tx," so Application code is identical
under either.

## ArrayBuffer ↔ Blob boundary (which layer owns each conversion)

- `Sticker.data` is **always** `ArrayBuffer` in the domain entity and in IDB
  (DOMAIN.md). Blobs are never persisted.
- **Inbound (write):** the Application layer converts source → `ArrayBuffer`
  *before* any tx. `File`/clipboard `Blob` → `await blob.arrayBuffer()` happens in
  `app/upload` / `app/services/importService.ts` (outside the tx, per the rule
  above). Repositories receive an entity that already holds an `ArrayBuffer`.
- **Outbound (read/use):** reconstruction `new Blob([sticker.data], { type:
  sticker.mimeType })` happens at the point of use — `app/services/yankService.ts`
  for clipboard, and in the UI when building an object URL for `<img>`. Repositories
  and the domain never produce Blobs.

So: Application owns both conversions; Ports/Infra and Domain only ever see
`ArrayBuffer`.

## Fake-implementation contract (test/fakes)

`FakeDatabase`, `FakeStickerRepository`, `FakePackRepository` (and fakes for the
other ports) MUST be LSP-substitutable for the real adapters. To qualify:
- Implement the identical interfaces and the identical `tx` semantics (a `tx` body
  that awaits foreign async must fail the same way the real one does).
- Throw on the same error conditions (e.g. operating outside a tx, malformed input)
  so the engine's single catch boundary behaves identically.
- Store `data` as `ArrayBuffer`; never coerce to Blob.
- Preserve write atomicity within a single `tx` call (all-or-nothing).

If a fake relaxes any of these, the substitution is invalid and the test is lying.