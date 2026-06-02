import { useEffect, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';

interface CachedURL {
  url: string;
  buffer: ArrayBuffer;
}

// Sticker.data is an ArrayBuffer. createObjectURL is expensive and must not be
// called on every render. This hook caches URLs keyed by sticker id and only
// creates/revokes when the ArrayBuffer reference itself changes.
// All URLs are revoked on unmount.
export function useObjectURLs(stickers: Sticker[]): ReadonlyMap<string, string> {
  // useState gives a stable Map reference (never replaced) without triggering
  // re-renders on mutation — same semantics as useRef but avoids ref-during-render.
  const [cache] = useState<Map<string, CachedURL>>(() => new Map());

  const nextIds = new Set(stickers.map(s => s.id));

  for (const [id, { url }] of cache) {
    if (!nextIds.has(id)) {
      URL.revokeObjectURL(url);
      cache.delete(id);
    }
  }

  for (const sticker of stickers) {
    const existing = cache.get(sticker.id);
    if (!existing || existing.buffer !== sticker.data) {
      if (existing) URL.revokeObjectURL(existing.url);
      const url = URL.createObjectURL(
        new Blob([sticker.data], { type: sticker.mimeType }),
      );
      cache.set(sticker.id, { url, buffer: sticker.data });
    }
  }

  useEffect(() => () => {
    for (const { url } of cache.values()) URL.revokeObjectURL(url);
    cache.clear();
  }, [cache]);

  return new Map([...cache].map(([id, { url }]) => [id, url]));
}
