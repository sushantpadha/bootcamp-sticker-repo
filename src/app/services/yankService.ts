import type { Sticker } from '../../domain/entities/sticker';
import type { ClipboardPort } from '../ports/clipboardPort';
import type { Database, StickerRepository } from '../ports/database';
import type { Clock } from '../ports/clock';
import { resolveNameCollision } from '../../domain/naming/resolveNameCollision';

export class YankService {
  private readonly clipboard: ClipboardPort;
  private readonly db: Database;
  private readonly stickers: StickerRepository;
  private readonly clock: Clock;
  private readonly onDownloadFallback: (blob: Blob, name: string) => void;

  constructor(
    clipboard: ClipboardPort,
    db: Database,
    stickers: StickerRepository,
    clock: Clock,
    onDownloadFallback: (blob: Blob, name: string) => void = () => {},
  ) {
    this.clipboard = clipboard;
    this.db = db;
    this.stickers = stickers;
    this.clock = clock;
    this.onDownloadFallback = onDownloadFallback;
  }

  // Copies the sticker image to the clipboard (download fallback if clipboard
  // throws). Updates lastUsedAt in one tx and returns the updated Sticker.
  // ArrayBuffer→Blob conversion happens outside the tx (IDB.md boundary rule).
  async yank(sticker: Sticker): Promise<Sticker> {
    const blob = new Blob([sticker.data], { type: sticker.mimeType });
    try {
      await this.clipboard.write(sticker.mimeType, blob);
    } catch {
      this.onDownloadFallback(blob, sticker.name);
    }
    const updated: Sticker = { ...sticker, lastUsedAt: this.clock.now() };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return updated;
  }

  // Removes a sticker from IDB in one tx.
  async deleteSticker(id: string): Promise<void> {
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.delete(scope, id);
    });
  }

  // Resolves the name collision (DOMAIN.md §Decision F), then writes the
  // updated sticker in one tx. Returns the stored sticker (with resolved name).
  async renameSticker(
    sticker: Sticker,
    newName: string,
    allStickers: Sticker[],
  ): Promise<Sticker> {
    // Exclude the sticker being renamed from the collision check so it doesn't
    // block itself.
    const others = allStickers.filter(s => s.id !== sticker.id);
    const resolvedName = resolveNameCollision(newName, sticker.packIds, others);
    const updated: Sticker = { ...sticker, name: resolvedName };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return updated;
  }

  // Updates the sticker's tags in one tx. Returns the updated Sticker.
  async setTags(sticker: Sticker, tags: string[]): Promise<Sticker> {
    const updated: Sticker = { ...sticker, tags };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return updated;
  }
}
