import type { Sticker } from '../../domain/entities/sticker';
import type { ClipboardPort } from '../ports/clipboardPort';
import type { Database, StickerRepository } from '../ports/database';
import type { Clock } from '../ports/clock';
import { resolveNameCollision } from '../../domain/naming/resolveNameCollision';
import { mimeExtension } from '../../domain/values/mime';

export interface YankResult {
  sticker: Sticker;     // updated with new lastUsedAt
  downloaded: boolean;  // true iff clipboard failed and download fallback fired
}

export class YankService {
  private readonly clipboard: ClipboardPort;
  private readonly db: Database;
  private readonly stickers: StickerRepository;
  private readonly clock: Clock;
  private readonly downloadBlob: (blob: Blob, filename: string) => void;

  constructor(
    clipboard: ClipboardPort,
    db: Database,
    stickers: StickerRepository,
    clock: Clock,
    downloadBlob: (blob: Blob, filename: string) => void,
  ) {
    this.clipboard = clipboard;
    this.db = db;
    this.stickers = stickers;
    this.clock = clock;
    this.downloadBlob = downloadBlob;
  }

  // Copies the sticker image to the clipboard. On clipboard failure (most
  // browsers refuse non-png mimes on writes), triggers a download fallback
  // with filename `<name>.<ext>`. Always updates lastUsedAt in one tx.
  async yank(sticker: Sticker): Promise<YankResult> {
    const blob = new Blob([sticker.data], { type: sticker.mimeType });
    const ext = mimeExtension[sticker.mimeType];
    let downloaded = false;
    try {
      await this.clipboard.write(sticker.mimeType, blob);
    } catch {
      this.downloadBlob(blob, `${sticker.name}${ext}`);
      downloaded = true;
    }
    const updated: Sticker = { ...sticker, lastUsedAt: this.clock.now() };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return { sticker: updated, downloaded };
  }

  async deleteSticker(id: string): Promise<void> {
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.delete(scope, id);
    });
  }

  // Resolves collision (DOMAIN.md §Decision F), then writes in one tx.
  async renameSticker(
    sticker: Sticker,
    newName: string,
    allStickers: Sticker[],
  ): Promise<Sticker> {
    const others = allStickers.filter(s => s.id !== sticker.id);
    const resolvedName = resolveNameCollision(newName, sticker.packIds, others);
    const updated: Sticker = { ...sticker, name: resolvedName };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return updated;
  }

  async setTags(sticker: Sticker, tags: string[]): Promise<Sticker> {
    const updated: Sticker = { ...sticker, tags };
    await this.db.tx(['stickers'], 'readwrite', scope => {
      this.stickers.put(scope, updated);
    });
    return updated;
  }
}
