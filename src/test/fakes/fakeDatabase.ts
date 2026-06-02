import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import { TxScope, type Database, type StoreName } from '../../app/ports/database';

// Snapshot of committed store state shared between FakeDatabase and its repos.
export interface FakeStore {
  stickers: Map<string, Sticker>;
  packs: Map<string, Pack>;
}

// Per-tx scope. Holds a working copy of committed maps so writes stay staged
// until tx commit. Enforces the `allowedStores` argument (real IDB throws if
// you touch a store outside the listed set; the fake matches this).
export class FakeTxScope extends TxScope {
  protected readonly _brand = undefined as void;
  private readonly committed: FakeStore;
  readonly mode: 'readonly' | 'readwrite';
  readonly allowedStores: ReadonlySet<StoreName>;
  readonly view: FakeStore;

  // Closed once tx() returns; subsequent repo calls on this scope throw
  // (mirrors real IDB's "Transaction is finished" error).
  private closed = false;

  constructor(
    committed: FakeStore,
    mode: 'readonly' | 'readwrite',
    stores: StoreName[],
  ) {
    super();
    this.committed = committed;
    this.mode = mode;
    this.allowedStores = new Set(stores);
    this.view = {
      stickers: new Map(committed.stickers),
      packs:    new Map(committed.packs),
    };
  }

  flush(): void {
    this.committed.stickers.clear();
    for (const [k, v] of this.view.stickers) this.committed.stickers.set(k, v);
    this.committed.packs.clear();
    for (const [k, v] of this.view.packs) this.committed.packs.set(k, v);
  }

  close(): void {
    this.closed = true;
  }

  assertOpen(): void {
    if (this.closed) {
      throw new Error('Transaction is finished');
    }
  }
}

export function asFakeTxScope(scope: TxScope): FakeTxScope {
  if (!(scope instanceof FakeTxScope)) {
    throw new Error('Operation issued outside a FakeDatabase transaction');
  }
  scope.assertOpen();
  return scope;
}

export class FakeDatabase implements Database {
  readonly store: FakeStore = {
    stickers: new Map(),
    packs:    new Map(),
  };

  async tx<T>(
    stores: StoreName[],
    mode: 'readonly' | 'readwrite',
    body: (scope: TxScope) => T,
  ): Promise<T> {
    const scope = new FakeTxScope(this.store, mode, stores);
    let result: T;
    try {
      result = body(scope);
    } catch (e) {
      scope.close();
      throw e;
    }
    // Body returned. If the result is a Promise (body was async), we surface
    // it but close the scope first — matching real IDB behavior where any
    // foreign await inside body would have auto-closed the tx.
    scope.flush();
    scope.close();
    return result;
  }

  async init(): Promise<void> {
    // No-op: nothing to open.
  }
}
