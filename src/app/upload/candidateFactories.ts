import type { StickerCandidate } from './stickerCandidate';
import { FileStickerCandidate } from './fileCandidate';
import { ClipboardStickerCandidate } from './clipboardCandidate';

export function createFileCandidate(file: File): StickerCandidate {
  return new FileStickerCandidate(file);
}

export function createClipboardCandidate(blob: Blob, index: number): StickerCandidate {
  return new ClipboardStickerCandidate(blob, index);
}
