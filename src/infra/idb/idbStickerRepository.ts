import type { Sticker } from '../../domain/entities/sticker';
import type { StickerRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asIdbTxScope } from './idbDatabase';

export class IdbStickerRepository implements StickerRepository {
  getAll(scope: TxScope): Sticker[] {
    return [...asIdbTxScope(scope).view.stickers.values()];
  }

  get(scope: TxScope, id: string): Sticker | undefined {
    return asIdbTxScope(scope).view.stickers.get(id);
  }

  put(scope: TxScope, entity: Sticker): void {
    const s = asIdbTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    if (!(entity.data instanceof ArrayBuffer)) {
      throw new Error('Sticker.data must be ArrayBuffer, not Blob');
    }
    s.view.stickers.set(entity.id, entity);
    s.idbTx!.objectStore('stickers').put(entity).onerror = () => {};
  }

  delete(scope: TxScope, id: string): void {
    const s = asIdbTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.stickers.delete(id);
    s.idbTx!.objectStore('stickers').delete(id).onerror = () => {};
  }
}
