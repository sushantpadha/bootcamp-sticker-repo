import type { StickerCandidate } from './stickerCandidate';
import type { SupportedMime } from '../../domain/values/mime';
import { coerceUploadMime } from './mimeCoercion';

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename;
}

// File-based StickerCandidate (drag-drop or <input type="file"> picker).
// Browsers may report APNG as image/apng; coerceUploadMime normalizes to png
// per DOMAIN.md §Decision G.
export class FileStickerCandidate implements StickerCandidate {
  readonly defaultName: string;
  readonly mimeType: SupportedMime;
  private readonly file: File;
  private objectUrl: string | null = null;

  constructor(file: File) {
    this.file = file;
    this.mimeType = coerceUploadMime(file.type);
    this.defaultName = stripExtension(file.name);
  }

  thumbnailUrl(): string {
    if (this.objectUrl === null) {
      this.objectUrl = URL.createObjectURL(this.file);
    }
    return this.objectUrl;
  }

  async resolveBytes(): Promise<ArrayBuffer> {
    return this.file.arrayBuffer();
  }
}
