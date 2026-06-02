import type { SupportedMime } from './mime';

// [LSP] Every upload source resolves to an ArrayBuffer the same way; the save
// pipeline never branches on the source type (DOMAIN.md §StickerCandidate).
export interface StickerCandidate {
  defaultName: string;
  mimeType: SupportedMime;
  thumbnailUrl(): string;               // object URL for 48×48 preview
  resolveBytes(): Promise<ArrayBuffer>; // always resolves to ArrayBuffer
}
