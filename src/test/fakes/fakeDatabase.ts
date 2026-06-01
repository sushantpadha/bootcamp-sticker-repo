import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import { TxScope, type Database, type StoreName } from '../../app/ports/database';

// Snapshot of committed store state shared between FakeDatabase and its repos.
export interface FakeStore {
  stickers: Map<string, Sticker>;
  packs: Map<string, Pack>;
}

// Concrete TxScope for FakeDatabase. Holds a working copy of the committed
// maps so reads see prior writes within the same tx and rollback is free.
export class FakeTxScope extends TxScope {
  protected readonly _brand = undefined as void;

  // Working copies; flushed to committed only on success.
  readonly view: FakeStore;

  constructor(
    private readonly committed: FakeStore,
    readonly mode: 'readonly' | 'readwrite',
  ) {
    super();
    // Shallow-copy each map so the tx sees a snapshot and writes stay staged.
    this.view = {
      stickers: new Map(committed.stickers),
      packs:    new Map(committed.packs),
    };
  }

  // Called by FakeDatabase after the body returns without throwing.
  flush(): void {
    this.committed.stickers.clear();
    for (const [k, v] of this.view.stickers) this.committed.stickers.set(k, v);
    this.committed.packs.clear();
    for (const [k, v] of this.view.packs) this.committed.packs.set(k, v);
  }
}

// Cast helper used by FakeRepository implementations. Throws if the scope was
// not created by FakeDatabase, matching the real IDB behaviour of rejecting
// operations outside an open transaction.
export function asFakeTxScope(scope: TxScope): FakeTxScope {
  if (!(scope instanceof FakeTxScope)) {
    throw new Error('Operation issued outside a FakeDatabase transaction');
  }
  return scope;
}

export class FakeDatabase implements Database {
  readonly store: FakeStore = {
    stickers: new Map(),
    packs:    new Map(),
  };

  async tx<T>(
    _stores: StoreName[],
    mode: 'readonly' | 'readwrite',
    body: (scope: TxScope) => T,
  ): Promise<T> {
    const scope = new FakeTxScope(this.store, mode);
    let result: T;
    try {
      result = body(scope);
    } catch (e) {
      // Body threw — discard scope; committed state is untouched (rollback).
      throw e;
    }
    // Body returned successfully — commit staged writes.
    scope.flush();
    return result;
  }

  async init(): Promise<void> {
    // No-op: nothing to open.
  }
}
