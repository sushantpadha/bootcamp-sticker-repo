import type { StickerCandidate } from './stickerCandidate';
import type { SupportedMime } from '../../domain/values/mime';
import { coerceUploadMime } from './mimeCoercion';

// Clipboard-paste StickerCandidate (Ctrl+V into upload modal).
// Defaults its name to "clipboard-<N>" where N is the row index at paste time.
export class ClipboardStickerCandidate implements StickerCandidate {
  readonly defaultName: string;
  readonly mimeType: SupportedMime;
  private readonly blob: Blob;
  private objectUrl: string | null = null;

  constructor(blob: Blob, index: number) {
    this.blob = blob;
    this.mimeType = coerceUploadMime(blob.type);
    this.defaultName = `clipboard-${index + 1}`;
  }

  thumbnailUrl(): string {
    if (this.objectUrl === null) {
      this.objectUrl = URL.createObjectURL(this.blob);
    }
    return this.objectUrl;
  }

  async resolveBytes(): Promise<ArrayBuffer> {
    return this.blob.arrayBuffer();
  }
}
