import type { Sticker } from '../../domain/entities/sticker';
import type { Pack } from '../../domain/entities/pack';
import type { ZipCodecPort, ExportManifest } from '../ports/zipCodecPort';
import type { Clock } from '../ports/clock';
import { mimeExtension } from '../../domain/values/mime';

export interface ExportResult {
  blob: Blob;
  filename: string;
  stickerCount: number;
}

export class ExportService {
  private readonly zip: ZipCodecPort;
  private readonly clock: Clock;

  constructor(zip: ZipCodecPort, clock: Clock) {
    this.zip = zip;
    this.clock = clock;
  }

  // Builds an export ZIP blob and SPEC-compliant filename. The caller is
  // responsible for triggering the browser download (via ports.downloadBlob).
  // Layout per IDB.md §ZIP export/import format:
  //   stickerdb-export-YYYY-MM-DD.zip
  //     manifest.json
  //     stickers/<id>.<ext>
  async exportAll(stickers: Sticker[], packs: Pack[]): Promise<ExportResult> {
    const exportedAt = this.clock.now();
    const files = new Map<string, ArrayBuffer>();
    const stickerEntries = stickers.map(s => {
      const ext = mimeExtension[s.mimeType];
      const file = `stickers/${s.id}${ext}`;
      files.set(file, s.data);
      return {
        id: s.id,
        name: s.name,
        packIds: s.packIds,
        tags: s.tags,
        mimeType: s.mimeType,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        file,
      };
    });
    const manifest: ExportManifest = {
      version: 1,
      exportedAt,
      packs: packs.map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt })),
      stickers: stickerEntries,
    };
    const blob = await this.zip.pack(manifest, files);
    const date = new Date(exportedAt).toISOString().slice(0, 10); // YYYY-MM-DD UTC
    return {
      blob,
      filename: `stickerdb-export-${date}.zip`,
      stickerCount: stickers.length,
    };
  }
}
