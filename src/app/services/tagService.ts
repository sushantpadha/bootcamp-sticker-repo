import type { Sticker } from '../../domain/entities/sticker';
import type { Database, StickerRepository } from '../ports/database';

// Tag-domain operations that span multiple stickers (e.g. global rename).
// Single-sticker tag mutations go through YankService.setTags.
export class TagService {
  private readonly db: Database;
  private readonly stickers: StickerRepository;

  constructor(db: Database, stickers: StickerRepository) {
    this.db = db;
    this.stickers = stickers;
  }

  // Globally rename tag `oldName` → `newName` across ALL stickers.
  // Case-sensitive exact match (DOMAIN.md §:tag rename).
  // Single tx; atomic; deduplicates the resulting tags array per sticker
  // (in case `newName` was already present alongside `oldName`).
  // Returns the count of affected stickers.
  // No-op when oldName === newName; returns 0.
  async renameTagGlobally(
    oldName: string,
    newName: string,
    allStickers: Sticker[],
  ): Promise<number> {
    if (oldName === newName) return 0;
    const affected = allStickers.filter(s => s.tags.includes(oldName));
    if (affected.length === 0) return 0;
    const updated: Sticker[] = affected.map(s => {
      const replaced = s.tags.map(t => t === oldName ? newName : t);
      const deduped = Array.from(new Set(replaced));
      return { ...s, tags: deduped };
    });
    await this.db.tx(['stickers'], 'readwrite', scope => {
      for (const s of updated) this.stickers.put(scope, s);
    });
    return updated.length;
  }
}
