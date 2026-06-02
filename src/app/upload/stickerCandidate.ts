import type { SupportedMime } from '../../domain/values/mime';

// DOMAIN.md §StickerCandidate — upload-source substitutability.
//
// [LSP] Every upload source resolves to an ArrayBuffer the same way; the
//       save pipeline never branches on the source type.
export interface StickerCandidate {
  defaultName: string;
  mimeType: SupportedMime;
  thumbnailUrl(): string;               // object URL for 48×48 preview
  resolveBytes(): Promise<ArrayBuffer>; // always resolves to ArrayBuffer
}
