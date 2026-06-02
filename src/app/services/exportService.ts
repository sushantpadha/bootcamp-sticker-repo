import type { Sticker } from '../../domain/entities/sticker';
import type { ZipCodecPort, ZipManifest } from '../ports/zipCodecPort';
import { mimeExtension } from '../../domain/values/mime';

export class ExportService {
  constructor(private readonly zip: ZipCodecPort) {}

  // Encodes the given stickers into a zip Blob.
  // Data is already ArrayBuffer in Sticker.data — no foreign async needed before
  // building the files map. zip.pack() is itself awaited but does not open an IDB tx.
  async exportStickers(stickers: Sticker[]): Promise<Blob> {
    const files = new Map<string, ArrayBuffer>();
    const manifest: ZipManifest = {
      version: 1,
      stickers: stickers.map(s => {
        const ext = mimeExtension[s.mimeType];
        const filename = `${s.id}${ext}`;
        files.set(filename, s.data);
        return {
          id: s.id,
          name: s.name,
          packIds: s.packIds,
          tags: s.tags,
          mimeType: s.mimeType,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
          filename,
        };
      }),
      packs: [],
    };
    return this.zip.pack(manifest, files);
  }
}
