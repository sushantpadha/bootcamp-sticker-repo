import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { Database, StickerRepository, PackRepository } from '../ports/database';
import type { ZipCodecPort } from '../ports/zipCodecPort';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import type { QueuedSticker } from '../upload/uploadQueue';
import { createSticker } from '../../domain/entities/sticker';
import { createPack } from '../../domain/entities/pack';
import { resolveNameCollision } from '../../domain/naming/resolveNameCollision';

export interface ImportResult {
  stickersImported: number;
  packsImported: number;
  stickersSkipped: number;
  packsSkipped: number;
}

export class ImportService {
  private readonly db: Database;
  private readonly stickers: StickerRepository;
  private readonly packs: PackRepository;
  private readonly zip: ZipCodecPort;

  constructor(
    db: Database,
    stickers: StickerRepository,
    packs: PackRepository,
    zip: ZipCodecPort,
  ) {
    this.db = db;
    this.stickers = stickers;
    this.packs = packs;
    this.zip = zip;
  }

  // UPLOAD modal save path: takes the in-memory queue and the current snapshot,
  // resolves all bytes outside any tx, then writes everything in one tx.
  async saveUpload(
    queue: QueuedSticker[],
    allStickers: Sticker[],
    allPacks: Pack[],
    idGen: IdGenerator,
    clock: Clock,
  ): Promise<{ stickers: Sticker[]; newPacks: Pack[] }> {
    if (queue.length === 0) return { stickers: [], newPacks: [] };

    // Step 1: resolve all bytes outside tx (IDB.md hard constraint).
    const buffers = await Promise.all(queue.map(row => row.candidate.resolveBytes()));

    // Step 2: resolve pack names → packs; collect new packs to create.
    const packMap = new Map<string, string>();   // name -> id
    const newPacks: Pack[] = [];
    for (const row of queue) {
      for (const name of row.packNames) {
        if (packMap.has(name)) continue;
        const existing = allPacks.find(p => p.name === name);
        if (existing) {
          packMap.set(name, existing.id);
        } else if (newPacks.find(p => p.name === name)) {
          packMap.set(name, newPacks.find(p => p.name === name)!.id);
        } else {
          const np = createPack({ id: idGen.uuid(), name, createdAt: clock.now() });
          newPacks.push(np);
          packMap.set(name, np.id);
        }
      }
    }

    // Step 3: build sticker entities with collision-resolved names. Collision
    // checks against existing + already-built-in-this-batch stickers.
    const now = clock.now();
    const built: Sticker[] = [];
    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      const packIds = row.packNames.map(n => packMap.get(n)!);
      const combined = [...allStickers, ...built];
      const resolvedName = resolveNameCollision(row.name, packIds, combined);
      built.push(createSticker({
        id: idGen.uuid(),
        name: resolvedName,
        packIds,
        tags: row.tags,
        data: buffers[i],
        mimeType: row.candidate.mimeType,
        createdAt: now,
      }));
    }

    // Step 4: ONE tx for all writes.
    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      for (const p of newPacks) this.packs.put(scope, p);
      for (const s of built) this.stickers.put(scope, s);
    });

    return { stickers: built, newPacks };
  }

  // ZIP import: dedup by id (IDB.md §Import dedup semantics).
  async importZip(file: File): Promise<ImportResult> {
    // Step 1: unpack outside tx (zip.unpack returns ArrayBuffers).
    const { manifest, files } = await this.zip.unpack(file);

    // Step 2: one tx — collect existing ids, then insert non-duplicates.
    let stickersImported = 0;
    let packsImported = 0;
    let stickersSkipped = 0;
    let packsSkipped = 0;

    await this.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      const existingPackIds = new Set(this.packs.getAll(scope).map(p => p.id));
      const existingStickerIds = new Set(this.stickers.getAll(scope).map(s => s.id));

      for (const p of manifest.packs) {
        if (existingPackIds.has(p.id)) {
          packsSkipped++;
        } else {
          this.packs.put(scope, { id: p.id, name: p.name, createdAt: p.createdAt });
          existingPackIds.add(p.id);
          packsImported++;
        }
      }

      for (const s of manifest.stickers) {
        if (existingStickerIds.has(s.id)) {
          stickersSkipped++;
          continue;
        }
        const buf = files.get(s.file);
        if (!buf) {
          stickersSkipped++;
          continue;
        }
        this.stickers.put(scope, {
          id: s.id,
          name: s.name,
          packIds: s.packIds,
          tags: s.tags,
          data: buf,
          mimeType: s.mimeType,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
        });
        existingStickerIds.add(s.id);
        stickersImported++;
      }
    });

    return { stickersImported, packsImported, stickersSkipped, packsSkipped };
  }
}
