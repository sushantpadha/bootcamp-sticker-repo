import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import { TxScope, type Database, type StoreName } from '../../app/ports/database';
import { DB_NAME, DB_VERSION, applySchema } from './schema';

// Concrete TxScope for IdbDatabase. Holds a pre-fetched in-memory view (for
// synchronous reads) and an optional IDB transaction handle (for writes).
export class IdbTxScope extends TxScope {
  protected readonly _brand = undefined as void;
  readonly view: { stickers: Map<string, Sticker>; packs: Map<string, Pack> };

  constructor(
    readonly idbTx: IDBTransaction | null,
    preloaded: { stickers: Sticker[]; packs: Pack[] },
    readonly mode: 'readonly' | 'readwrite',
  ) {
    super();
    this.view = {
      stickers: new Map(preloaded.stickers.map(s => [s.id, s])),
      packs:    new Map(preloaded.packs.map(p => [p.id, p])),
    };
  }
}

export function asIdbTxScope(scope: TxScope): IdbTxScope {
  if (!(scope instanceof IdbTxScope)) {
    throw new Error('Operation issued outside an IdbDatabase transaction');
  }
  return scope;
}


export class IdbDatabase implements Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
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

  async tx<T>(
    stores: StoreName[],
    mode: 'readonly' | 'readwrite',
    body: (scope: TxScope) => T,
  ): Promise<T> {
    if (!this.db) throw new Error('IdbDatabase: call init() before tx()');

    // Phase 1: pre-fetch all data from the listed stores in a readonly tx so the
    // body can return synchronously. This matches the fake's behaviour exactly.
    const preloaded: { stickers: Sticker[]; packs: Pack[] } = {
      stickers: [],
      packs:    [],
    };
    await new Promise<void>((resolve, reject) => {
      const prefetchTx = this.db!.transaction(stores, 'readonly');
      let pending = 0;

      if (stores.includes('stickers')) {
        pending++;
        const req = prefetchTx.objectStore('stickers').getAll() as IDBRequest<Sticker[]>;
        req.onsuccess = () => {
          preloaded.stickers = req.result;
          if (--pending === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
      if (stores.includes('packs')) {
        pending++;
        const req = prefetchTx.objectStore('packs').getAll() as IDBRequest<Pack[]>;
        req.onsuccess = () => {
          preloaded.packs = req.result;
          if (--pending === 0) resolve();
        };
        req.onerror = () => reject(req.error);
      }
      if (pending === 0) resolve();
      prefetchTx.onerror = () => reject(prefetchTx.error);
    });

    // Phase 2: for readwrite, open a write transaction; body issues IDB put/delete
    // requests synchronously inside it, then we await oncomplete.
    let idbTx: IDBTransaction | null = null;
    let txComplete: Promise<void> | null = null;

    if (mode === 'readwrite') {
      idbTx = this.db.transaction(stores, 'readwrite');
      txComplete = new Promise<void>((resolve, reject) => {
        idbTx!.oncomplete = () => resolve();
        idbTx!.onerror   = () => reject(idbTx!.error);
        idbTx!.onabort   = () => reject(new Error('Transaction aborted'));
      });
    }

    const scope = new IdbTxScope(idbTx, preloaded, mode);
    let result: T;
    try {
      result = body(scope); // synchronous — body only calls put/delete on repos
    } catch (e) {
      if (idbTx) {
        idbTx.abort();
        txComplete?.catch(() => {}); // suppress the expected "Transaction aborted" rejection
      }
      throw e;
    }

    if (txComplete) await txComplete;
    return result;
  }
}
