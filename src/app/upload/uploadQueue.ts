import type { StickerCandidate } from './stickerCandidate';

// One editable row in the upload modal. Persisted in AppState.uploadQueue
// only while UPLOAD mode is active (cleared on UPLOAD onExit).
export interface QueuedSticker {
  candidate: StickerCandidate;     // source (file / clipboard)
  name: string;                    // prefilled from candidate.defaultName; user-editable
  tags: string[];
  packNames: string[];             // resolved to packIds on save
}
