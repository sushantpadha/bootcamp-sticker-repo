import type { SupportedMime } from '../../domain/values/mime';
import type { ClipboardPort } from '../../app/ports/clipboardPort';

export class NavigatorClipboard implements ClipboardPort {
  async write(mime: SupportedMime, blob: Blob): Promise<void> {
    await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
  }
}
