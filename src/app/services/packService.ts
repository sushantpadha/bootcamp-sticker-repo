import type { Pack } from '../../domain/entities/pack';
import type { Sticker } from '../../domain/entities/sticker';
import type { Database, PackRepository, StickerRepository } from '../ports/database';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';

export class PackService {
  private readonly db: Database;
  private readonly packs: PackRepository;
  private readonly stickers: StickerRepository;
  private readonly idGen: IdGenerator;
  private readonly clock: Clock;

  constructor(
    db: Database,
    packs: PackRepository,
    stickers: StickerRepository,
    idGen: IdGenerator,
    clock: Clock,
  ) {
    this.db = db;
    this.packs = packs;
    this.stickers = stickers;
    this.idGen = idGen;
    this.clock = clock;
  }

  // Creates a new pack with a generated UUID. One tx write.
  async createPack(name: string): Promise<Pack> {
    const pack: Pack = {
      id: this.idGen.uuid(),
      name,
      createdAt: this.clock.now(),
    };
    await this.db.tx(['packs'], 'readwrite', scope => {
      this.packs.put(scope, pack);
    });
    return pack;
  }

  // Renames the pack. One tx write.
  async renamePack(pack: Pack, newName: string): Promise<Pack> {
    const updated: Pack = { ...pack, name: newName };
    await this.db.tx(['packs'], 'readwrite', scope => {
      this.packs.put(scope, updated);
    });
    return updated;
  }

  // Deletes the pack and strips its id from every sticker that references it.
  // One tx over both stores (IDB.md: one tx per operation).
  async deletePack(packId: string, allStickers: Sticker[]): Promise<void> {
    const affected = allStickers.filter(s => s.packIds.includes(packId));
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      this.packs.delete(scope, packId);
      for (const s of affected) {
        this.stickers.put(scope, {
          ...s,
          packIds: s.packIds.filter(id => id !== packId),
        });
      }
    });
  }

  // Resolves pack names to IDs (creating packs that don't exist yet), then
  // updates the sticker's packIds. All non-IDB logic runs before the tx.
  // Returns the updated sticker and any newly created packs.
  async assignPacks(
    sticker: Sticker,
    packNames: string[],
    allPacks: Pack[],
    _allStickers: Sticker[],
  ): Promise<{ sticker: Sticker; newPacks: Pack[] }> {
    // Resolve names → existing packs and collect names that need creation.
    const resolved: Pack[] = [];
    const toCreate: string[] = [];
    for (const name of packNames) {
      const existing = allPacks.find(p => p.name === name);
      if (existing) {
        resolved.push(existing);
      } else {
        toCreate.push(name);
      }
    }

    // Build new Pack objects outside the tx (id generation is not IDB async).
    const newPacks: Pack[] = toCreate.map(name => ({
      id: this.idGen.uuid(),
      name,
      createdAt: this.clock.now(),
    }));

    const updatedSticker: Sticker = {
      ...sticker,
      packIds: [...new Set([...resolved, ...newPacks].map(p => p.id))],
    };

    // One tx for all writes: new packs + updated sticker.
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      for (const p of newPacks) this.packs.put(scope, p);
      this.stickers.put(scope, updatedSticker);
    });

    return { sticker: updatedSticker, newPacks };
  }
}
