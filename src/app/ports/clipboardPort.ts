import type { SupportedMime } from '../../domain/values/mime';

// [LSP] write() throws on failure; never resolves silently on error.
export interface ClipboardPort {
  write(mime: SupportedMime, blob: Blob): Promise<void>;
}
