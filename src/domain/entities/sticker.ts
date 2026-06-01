import type { SupportedMime } from '../values/mime';

export interface Sticker {
  id: string;
  name: string;
  packIds: string[];
  tags: string[];
  data: ArrayBuffer;
  mimeType: SupportedMime;
  createdAt: number;
  lastUsedAt: number;
}
