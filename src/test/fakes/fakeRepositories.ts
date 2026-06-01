import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { StickerRepository, PackRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asFakeTxScope } from './fakeDatabase';

export class FakeStickerRepository implements StickerRepository {
  getAll(scope: TxScope): Sticker[] {
    return [...asFakeTxScope(scope).view.stickers.values()];
  }

  get(scope: TxScope, id: string): Sticker | undefined {
    return asFakeTxScope(scope).view.stickers.get(id);
  }

  put(scope: TxScope, entity: Sticker): void {
    const s = asFakeTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    // [LSP] Sticker.data must always be ArrayBuffer; reject Blobs.
    if (!(entity.data instanceof ArrayBuffer)) {
      throw new Error('Sticker.data must be ArrayBuffer, not Blob');
    }
    s.view.stickers.set(entity.id, entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asFakeTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.stickers.delete(id);
  }
}

export class FakePackRepository implements PackRepository {
  getAll(scope: TxScope): Pack[] {
    return [...asFakeTxScope(scope).view.packs.values()];
  }

  get(scope: TxScope, id: string): Pack | undefined {
    return asFakeTxScope(scope).view.packs.get(id);
  }

  put(scope: TxScope, entity: Pack): void {
    const s = asFakeTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.set(entity.id, entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asFakeTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.delete(id);
  }
}
