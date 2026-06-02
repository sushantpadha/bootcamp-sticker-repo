import { useEffect, useRef, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';

interface CachedURL {
  url: string;
  buffer: ArrayBuffer;
}

// Sticker.data → object URL cache. Side effects in useEffect (NOT in render).
// Returns a stable Map reference (the same instance across renders); React
// observers compare by identity → no spurious re-renders on cache mutation.
export function useObjectURLs(stickers: Sticker[]): ReadonlyMap<string, string> {
  const cacheRef = useRef<Map<string, CachedURL>>(new Map());
  // We expose a derived `Map<string, string>` view; recompute it only when
  // the cache content changes (signalled by `version`).
  const [version, bumpVersion] = useState(0);

  useEffect(() => {
    const cache = cacheRef.current;
    const nextIds = new Set(stickers.map(s => s.id));
    let dirty = false;

    // Remove URLs for stickers no longer present.
    for (const [id, { url }] of cache) {
      if (!nextIds.has(id)) {
        URL.revokeObjectURL(url);
        cache.delete(id);
        dirty = true;
      }
    }

    // Add / refresh URLs for incoming / changed-buffer stickers.
    for (const sticker of stickers) {
      const existing = cache.get(sticker.id);
      if (!existing || existing.buffer !== sticker.data) {
        if (existing) URL.revokeObjectURL(existing.url);
        const url = URL.createObjectURL(
          new Blob([sticker.data], { type: sticker.mimeType }),
        );
        cache.set(sticker.id, { url, buffer: sticker.data });
        dirty = true;
      }
    }

    if (dirty) bumpVersion(v => v + 1);
  }, [stickers]);

  // Unmount cleanup.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const { url } of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  // Public view: a plain Map of id → url. Re-derived only when version bumps.
  // We use useRef + version so React identity changes only when content does.
  const viewRef = useRef<ReadonlyMap<string, string>>(new Map());
  const lastVersion = useRef(-1);
  if (version !== lastVersion.current) {
    viewRef.current = new Map(
      [...cacheRef.current].map(([id, { url }]) => [id, url]),
    );
    lastVersion.current = version;
  }
  return viewRef.current;
}
