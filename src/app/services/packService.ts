import type { Pack, CreatePackInput } from '../../domain/entities/pack';
import type { Sticker } from '../../domain/entities/sticker';
import type { Database, PackRepository, StickerRepository } from '../ports/database';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import { createPack } from '../../domain/entities/pack';
import { resolveNameCollision } from '../../domain/naming/resolveNameCollision';

export interface MoveResult {
  sticker: Sticker;       // updated focused sticker
  pack: Pack;             // the destination pack (existing or new)
  created: boolean;       // true iff pack was created in this op
  alreadyMember: boolean; // true iff sticker was already in pack (no-op write)
}

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

  // Create a pack with the given name. Throws if a pack with that name already
  // exists (DOMAIN.md §:pack new collision rule). Single tx.
  async createPackWithName(name: string, allPacks: Pack[]): Promise<Pack> {
    if (allPacks.some(p => p.name === name)) {
      throw new Error(`pack "${name}" already exists`);
    }
    const input: CreatePackInput = {
      id: this.idGen.uuid(),
      name,
      createdAt: this.clock.now(),
    };
    const pack = createPack(input);
    await this.db.tx(['packs'], 'readwrite', scope => {
      this.packs.put(scope, pack);
    });
    return pack;
  }

  // Rename an existing pack. Idempotent if newName === pack.name. Throws if
  // another pack already uses newName.
  async renamePackTo(pack: Pack, newName: string, allPacks: Pack[]): Promise<Pack> {
    if (pack.name === newName) return pack;
    if (allPacks.some(p => p.id !== pack.id && p.name === newName)) {
      throw new Error(`pack "${newName}" already exists`);
    }
    const updated: Pack = { ...pack, name: newName };
    await this.db.tx(['packs'], 'readwrite', scope => {
      this.packs.put(scope, updated);
    });
    return updated;
  }

  // Delete a pack and strip its id from every sticker that referenced it.
  // Single tx over both stores. Returns count of affected stickers.
  async deletePackAndCleanup(packId: string, allStickers: Sticker[]): Promise<number> {
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
    return affected.length;
  }

  // Move focused sticker into a named pack (create-if-missing).
  // See DOMAIN.md §:pack move.
  async movePackForSticker(
    sticker: Sticker,
    packName: string,
    allPacks: Pack[],
    allStickers: Sticker[],
  ): Promise<MoveResult> {
    const existing = allPacks.find(p => p.name === packName);
    if (existing && sticker.packIds.includes(existing.id)) {
      return { sticker, pack: existing, created: false, alreadyMember: true };
    }
    const pack: Pack = existing ?? createPack({
      id: this.idGen.uuid(),
      name: packName,
      createdAt: this.clock.now(),
    });
    const newPackIds = [...sticker.packIds, pack.id];
    const resolvedName = resolveNameCollision(
      sticker.name,
      newPackIds,
      allStickers.filter(s => s.id !== sticker.id),
    );
    const updatedSticker: Sticker = {
      ...sticker,
      name: resolvedName,
      packIds: newPackIds,
    };
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      if (!existing) this.packs.put(scope, pack);
      this.stickers.put(scope, updatedSticker);
    });
    return { sticker: updatedSticker, pack, created: existing === undefined, alreadyMember: false };
  }

  // PACKASSIGN mode handler — resolve a list of pack names to ids
  // (creating missing packs), apply collision-resolved rename if needed,
  // write everything in one tx.
  async assignPacks(
    sticker: Sticker,
    packNames: string[],
    allPacks: Pack[],
    allStickers: Sticker[],
  ): Promise<{ sticker: Sticker; newPacks: Pack[] }> {
    const resolved: Pack[] = [];
    const toCreate: string[] = [];
    for (const name of packNames) {
      const existing = allPacks.find(p => p.name === name);
      if (existing) resolved.push(existing);
      else if (!toCreate.includes(name)) toCreate.push(name);
    }
    const newPacks: Pack[] = toCreate.map(name => createPack({
      id: this.idGen.uuid(),
      name,
      createdAt: this.clock.now(),
    }));
    const newPackIds = [...new Set([...resolved, ...newPacks].map(p => p.id))];

    const resolvedName = resolveNameCollision(
      sticker.name,
      newPackIds,
      allStickers.filter(s => s.id !== sticker.id),
    );

    const updatedSticker: Sticker = {
      ...sticker,
      name: resolvedName,
      packIds: newPackIds,
    };

    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      for (const p of newPacks) this.packs.put(scope, p);
      this.stickers.put(scope, updatedSticker);
    });

    return { sticker: updatedSticker, newPacks };
  }
}
