import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { StickerRepository, PackRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asFakeTxScope } from './fakeDatabase';

export class FakeStickerRepository implements StickerRepository {
  getAll(scope: TxScope): Sticker[] {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    return [...s.view.stickers.values()];
  }

  get(scope: TxScope, id: string): Sticker | undefined {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    return s.view.stickers.get(id);
  }

  put(scope: TxScope, entity: Sticker): void {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    if (!(entity.data instanceof ArrayBuffer)) {
      throw new Error('Sticker.data must be ArrayBuffer, not Blob');
    }
    s.view.stickers.set(entity.id, entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.stickers.delete(id);
  }
}

export class FakePackRepository implements PackRepository {
  getAll(scope: TxScope): Pack[] {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    return [...s.view.packs.values()];
  }

  get(scope: TxScope, id: string): Pack | undefined {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    return s.view.packs.get(id);
  }

  put(scope: TxScope, entity: Pack): void {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.set(entity.id, entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asFakeTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.delete(id);
  }
}
