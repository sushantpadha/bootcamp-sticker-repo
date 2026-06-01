import type { SupportedMime } from '../../domain/values/mime';
import type { ClipboardPort } from '../../app/ports/clipboardPort';

export class FakeClipboard implements ClipboardPort {
  lastMime: SupportedMime | null = null;
  lastBlob: Blob | null = null;

  async write(mime: SupportedMime, blob: Blob): Promise<void> {
    this.lastMime = mime;
    this.lastBlob = blob;
  }
}
