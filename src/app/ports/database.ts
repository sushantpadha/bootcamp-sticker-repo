import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';

export type StoreName = 'stickers' | 'packs';

// Opaque token passed to Repository methods to prove the call is inside an
// open Database.tx() body. Concrete subtypes live in infra/idb and test/fakes.
export abstract class TxScope {
  protected abstract readonly _brand: void;
}

export interface Database {
  // [LSP] The tx body may ONLY issue IDB-request-backed repo calls.
  //       It must NOT await foreign async (arrayBuffer(), zip parsing, fetch...).
  tx<T>(
    stores: StoreName[],
    mode: 'readonly' | 'readwrite',
    body: (scope: TxScope) => T,
  ): Promise<T>;
  init(): Promise<void>; // open DB v1, request persistence
}

export interface Repository<E extends { id: string }> {
  getAll(scope: TxScope): E[];           // snapshot into memory (no cursors for views)
  get(scope: TxScope, id: string): E | undefined;
  put(scope: TxScope, entity: E): void;  // write within the provided tx only
  delete(scope: TxScope, id: string): void;
}

export interface StickerRepository extends Repository<Sticker> {}
export interface PackRepository    extends Repository<Pack> {}
