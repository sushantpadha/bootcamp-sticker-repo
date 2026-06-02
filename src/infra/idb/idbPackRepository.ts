import type { Pack } from '../../domain/entities/pack';
import type { PackRepository } from '../../app/ports/database';
import { TxScope } from '../../app/ports/database';
import { asIdbTxScope } from './idbDatabase';

export class IdbPackRepository implements PackRepository {
  getAll(scope: TxScope): Pack[] {
    return [...asIdbTxScope(scope).view.packs.values()];
  }

  get(scope: TxScope, id: string): Pack | undefined {
    return asIdbTxScope(scope).view.packs.get(id);
  }

  put(scope: TxScope, entity: Pack): void {
    const s = asIdbTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.set(entity.id, entity);
    s.idbTx!.objectStore('packs').put(entity).onerror = () => {};
  }

  delete(scope: TxScope, id: string): void {
    const s = asIdbTxScope(scope);
    if (s.mode !== 'readwrite') throw new Error('Cannot write in a readonly transaction');
    s.view.packs.delete(id);
    s.idbTx!.objectStore('packs').delete(id).onerror = () => {};
  }
}
