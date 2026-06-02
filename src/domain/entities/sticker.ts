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

export interface CreateStickerInput {
  id: string;                  // caller wires IdGenerator.uuid()
  name: string;
  packIds?: string[];
  tags?: string[];
  data: ArrayBuffer;
  mimeType: SupportedMime;
  createdAt: number;           // caller wires Clock.now()
  lastUsedAt?: number;         // defaults to createdAt
}

// Pure entity factory. Normalizes optional fields and enforces invariants.
// Caller is responsible for id (UUID) and timestamps so this stays pure.
export function createSticker(input: CreateStickerInput): Sticker {
  if (input.name.length === 0) throw new Error('Sticker.name must be non-empty');
  return {
    id: input.id,
    name: input.name,
    packIds: [...(input.packIds ?? [])],
    tags: [...(input.tags ?? [])],
    data: input.data,
    mimeType: input.mimeType,
    createdAt: input.createdAt,
    lastUsedAt: input.lastUsedAt ?? input.createdAt,
  };
}
