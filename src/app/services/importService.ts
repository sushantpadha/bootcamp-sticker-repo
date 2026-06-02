import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { Database, StickerRepository, PackRepository } from '../ports/database';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import type { ZipCodecPort } from '../ports/zipCodecPort';
import type { QueuedSticker } from '../engine/appState';
import { resolveNameCollision } from '../../domain/naming/resolveNameCollision';

export class ImportService {
  private readonly db: Database;
  private readonly stickers: StickerRepository;
  private readonly packs: PackRepository;
  private readonly idGen: IdGenerator;
  private readonly clock: Clock;
  private readonly zip: ZipCodecPort;

  constructor(
    db: Database,
    stickers: StickerRepository,
    packs: PackRepository,
    idGen: IdGenerator,
    clock: Clock,
    zip: ZipCodecPort,
  ) {
    this.db = db;
    this.stickers = stickers;
    this.packs = packs;
    this.idGen = idGen;
    this.clock = clock;
    this.zip = zip;
  }

  // Saves the upload queue to IDB.
  //
  // Transaction discipline (IDB.md hard constraint):
  //   Step 1 — resolve all bytes OUTSIDE the tx (foreign async).
  //   Step 2 — compute IDs, resolve pack names, run collision logic.
  //   Step 3 — ONE tx over ['stickers', 'packs'] for every write.
  async saveUpload(
    queue: QueuedSticker[],
    allStickers: Sticker[],
    allPacks: Pack[],
  ): Promise<{ stickers: Sticker[]; newPacks: Pack[] }> {
    if (queue.length === 0) return { stickers: [], newPacks: [] };

    // Step 1: resolve all bytes outside tx.
    const buffers = await Promise.all(queue.map(row => row.candidate.resolveBytes()));

    // Step 2: resolve pack names → IDs, build new Pack objects for unknown names.
    const { packMap, newPacks } = resolvePacks(
      queue.flatMap(row => row.packNames),
      allPacks,
      this.idGen,
      this.clock,
    );

    // Build sticker entities — collision resolution runs against all existing
    // stickers plus stickers already built in this batch.
    const now = this.clock.now();
    const builtStickers: Sticker[] = [];
    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      const packIds = row.packNames.map(n => packMap.get(n)!);
      const combinedExisting = [...allStickers, ...builtStickers];
      const resolvedName = resolveNameCollision(row.name, packIds, combinedExisting);
      builtStickers.push({
        id: this.idGen.uuid(),
        name: resolvedName,
        packIds,
        tags: row.tags,
        data: buffers[i],
        mimeType: row.candidate.mimeType,
        createdAt: now,
        lastUsedAt: now,
      });
    }

    // Step 3: one tx for all writes.
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      for (const p of newPacks) this.packs.put(scope, p);
      for (const s of builtStickers) this.stickers.put(scope, s);
    });

    return { stickers: builtStickers, newPacks };
  }

  // Imports stickers from a zip file.
  //
  // Transaction discipline:
  //   Step 1 — zip.unpack(file) outside tx (already returns ArrayBuffers).
  //   Step 2 — compute IDs, name collisions.
  //   Step 3 — ONE tx over ['stickers', 'packs'].
  async importZip(
    file: File,
    allStickers: Sticker[],
    allPacks: Pack[],
  ): Promise<{ stickers: Sticker[]; newPacks: Pack[] }> {
    // Step 1: unpack outside tx. ZipCodecPort guarantees ArrayBuffers.
    const { manifest, files } = await this.zip.unpack(file);

    // Step 2: resolve packs and build sticker entities.
    const packNames = manifest.packs.map(p => p.name);
    const { packMap, newPacks } = resolvePacks(packNames, allPacks, this.idGen, this.clock);

    // Also register packs from the manifest that carried explicit IDs.
    // Prefer the manifest's pack id when importing — but only for packs that
    // are not already present in allPacks by name. The packMap already handles
    // name-based resolution; here we build a separate id-remap table.
    const manifestPackIdToLocal = new Map<string, string>();
    for (const mp of manifest.packs) {
      const localId = packMap.get(mp.name);
      if (localId !== undefined) {
        manifestPackIdToLocal.set(mp.id, localId);
      }
    }

    const now = this.clock.now();
    const builtStickers: Sticker[] = [];
    for (const entry of manifest.stickers) {
      const buf = files.get(entry.filename);
      if (!buf) continue; // skip entries with missing data

      const localPackIds = entry.packIds
        .map(id => manifestPackIdToLocal.get(id))
        .filter((id): id is string => id !== undefined);

      const combinedExisting = [...allStickers, ...builtStickers];
      const resolvedName = resolveNameCollision(entry.name, localPackIds, combinedExisting);
      builtStickers.push({
        id: this.idGen.uuid(),
        name: resolvedName,
        packIds: localPackIds,
        tags: entry.tags,
        data: buf,
        mimeType: entry.mimeType as Sticker['mimeType'],
        createdAt: entry.createdAt,
        lastUsedAt: now,
      });
    }

    // Step 3: one tx.
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      for (const p of newPacks) this.packs.put(scope, p);
      for (const s of builtStickers) this.stickers.put(scope, s);
    });

    return { stickers: builtStickers, newPacks };
  }
}

// Resolves a list of pack names against existing packs, creating new Pack
// objects (not yet persisted) for names that don't exist. Returns a name→id
// map covering all names and the new packs list.
function resolvePacks(
  names: string[],
  allPacks: Pack[],
  idGen: IdGenerator,
  clock: Clock,
): { packMap: Map<string, string>; newPacks: Pack[] } {
  const packMap = new Map<string, string>();
  const newPacks: Pack[] = [];
  for (const name of names) {
    if (packMap.has(name)) continue;
    const existing = allPacks.find(p => p.name === name);
    if (existing) {
      packMap.set(name, existing.id);
    } else {
      // Check if already created in this batch.
      const already = newPacks.find(p => p.name === name);
      if (already) {
        packMap.set(name, already.id);
      } else {
        const pack: Pack = { id: idGen.uuid(), name, createdAt: clock.now() };
        newPacks.push(pack);
        packMap.set(name, pack.id);
      }
    }
  }
  return { packMap, newPacks };
}
