import type { Sticker } from '../../domain/entities/sticker';
import type { StickerRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asIdbTxScope } from './idbDatabase';

export class IdbStickerRepository implements StickerRepository {
  getAll(scope: TxScope): Sticker[] {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    return [...s.getStickersView().values()];
  }

  get(scope: TxScope, id: string): Sticker | undefined {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    return s.getStickersView().get(id);
  }

  put(scope: TxScope, entity: Sticker): void {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    if (!(entity.data instanceof ArrayBuffer)) {
      throw new Error('Sticker.data must be ArrayBuffer, not Blob');
    }
    s.getStickersView().set(entity.id, entity);
    // Issue IDB write; default onerror lets the error bubble to tx abort
    // (IDB.md decision J — single catch boundary catches the resulting
    // rejection in the engine).
    s.idbTx.objectStore('stickers').put(entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('stickers')) {
      throw new Error('stickers store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.getStickersView().delete(id);
    s.idbTx.objectStore('stickers').delete(id);
  }
}
