import type { Pack } from '../../domain/entities/pack';
import type { PackRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asIdbTxScope } from './idbDatabase';

export class IdbPackRepository implements PackRepository {
  getAll(scope: TxScope): Pack[] {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    return [...s.getPacksView().values()];
  }

  get(scope: TxScope, id: string): Pack | undefined {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    return s.getPacksView().get(id);
  }

  put(scope: TxScope, entity: Pack): void {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.getPacksView().set(entity.id, entity);
    s.idbTx.objectStore('packs').put(entity);
  }

  delete(scope: TxScope, id: string): void {
    const s = asIdbTxScope(scope);
    if (!s.allowedStores.has('packs')) {
      throw new Error('packs store not in this tx scope');
    }
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.getPacksView().delete(id);
    s.idbTx.objectStore('packs').delete(id);
  }
}
