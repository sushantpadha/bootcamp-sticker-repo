import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import { TxScope, type Database, type StoreName } from '../../app/ports/database';
import { DB_NAME, DB_VERSION, applySchema } from './schema';

// ── IdbTxScope ────────────────────────────────────────────────────────────────
//
// Per-transaction scope handed to repositories. Carries the live IDBTransaction
// plus a lazy in-memory view (Map) of each accessed store. Repository reads
// populate the view via getAll() on first access; subsequent reads use the
// view directly so they're synchronous. Writes go to BOTH the view (so later
// reads in the same tx see them) and the IDBObjectStore (for commit).
//
// This is single-tx by construction: there is no separate prefetch transaction.
// Both real and fake databases honor the same body semantics.

export class IdbTxScope extends TxScope {
  protected readonly _brand = undefined as void;
  readonly idbTx: IDBTransaction;
  readonly mode: 'readonly' | 'readwrite';
  readonly allowedStores: ReadonlySet<StoreName>;

  // Lazy-populated views. `null` = not yet loaded; `Map` = loaded snapshot.
  private stickersView: Map<string, Sticker> | null = null;
  private packsView: Map<string, Pack> | null = null;

  constructor(
    idbTx: IDBTransaction,
    mode: 'readonly' | 'readwrite',
    stores: StoreName[],
  ) {
    super();
    this.idbTx = idbTx;
    this.mode = mode;
    this.allowedStores = new Set(stores);
  }

  // Synchronous view accessors used by IdbStickerRepository / IdbPackRepository.
  // On first access, populate the view by issuing a getAll request against the
  // SAME tx and waiting for it via a Promise. To keep repo APIs synchronous,
  // callers must pre-load via `prepareViews()` before running the body.
  getStickersView(): Map<string, Sticker> {
    if (this.stickersView === null) {
      throw new Error('IdbTxScope: stickers view not prepared (internal bug)');
    }
    return this.stickersView;
  }
  getPacksView(): Map<string, Pack> {
    if (this.packsView === null) {
      throw new Error('IdbTxScope: packs view not prepared (internal bug)');
    }
    return this.packsView;
  }

  // Called by IdbDatabase.tx before running body. Issues getAll for each
  // listed store WITHIN the same readwrite/readonly tx, populating views
  // synchronously from the user code's perspective.
  async prepareViews(): Promise<void> {
    const awaits: Promise<void>[] = [];
    if (this.allowedStores.has('stickers')) {
      awaits.push(this.loadStickers());
    } else {
      this.stickersView = new Map();
    }
    if (this.allowedStores.has('packs')) {
      awaits.push(this.loadPacks());
    } else {
      this.packsView = new Map();
    }
    await Promise.all(awaits);
  }

  private loadStickers(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.idbTx.objectStore('stickers').getAll() as IDBRequest<Sticker[]>;
      req.onsuccess = () => {
        this.stickersView = new Map(req.result.map(s => [s.id, s]));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private loadPacks(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.idbTx.objectStore('packs').getAll() as IDBRequest<Pack[]>;
      req.onsuccess = () => {
        this.packsView = new Map(req.result.map(p => [p.id, p]));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export function asIdbTxScope(scope: TxScope): IdbTxScope {
  if (!(scope instanceof IdbTxScope)) {
    throw new Error('Operation issued outside an IdbDatabase transaction');
  }
  return scope;
}

// ── IdbDatabase ───────────────────────────────────────────────────────────────

export class IdbDatabase implements Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = event => {
        applySchema((event.target as IDBOpenDBRequest).result);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    // Fire-and-forget — IDB.md: "request persistence on init"
    if (typeof navigator !== 'undefined') {
      navigator.storage?.persist?.().catch(() => {});
    }
  }

  // Single tx for both reads and writes. The body MUST be synchronous after
  // prepareViews() resolves; any foreign await inside body lets the tx
  // auto-close (matches real IDB behavior; matches FakeDatabase semantics).
  async tx<T>(
    stores: StoreName[],
    mode: 'readonly' | 'readwrite',
    body: (scope: TxScope) => T,
  ): Promise<T> {
    if (!this.db) throw new Error('IdbDatabase: call init() before tx()');

    const idbTx = this.db.transaction(stores, mode);
    const scope = new IdbTxScope(idbTx, mode, stores);

    // Pre-load views WITHIN the same tx (so reads are synchronous in body).
    await scope.prepareViews();

    // After this point body must be synchronous (no foreign awaits).
    let result: T;
    try {
      result = body(scope);
    } catch (e) {
      try { idbTx.abort(); } catch { /* tx may already be closed */ }
      throw e;
    }

    // For readonly: tx auto-completes after the last request settles.
    // For readwrite: we wait for the commit.
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        idbTx.oncomplete = () => resolve();
        idbTx.onerror   = () => reject(idbTx.error);
        idbTx.onabort   = () => reject(new Error('Transaction aborted'));
      });
    }
    return result;
  }
}
