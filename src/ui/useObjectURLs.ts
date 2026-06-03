import { useEffect, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';

interface CachedURL {
  url: string;
  buffer: ArrayBuffer;
}

// Sticker.data → object URL cache. ALL side effects inside useEffect (never
// during render). Returns a Map<id, url> view derived from a useState-held
// cache. When the cache mutates inside the effect we trigger a re-render
// by updating the version, which causes a new derived Map to be produced.
export function useObjectURLs(stickers: Sticker[]): ReadonlyMap<string, string> {
  // Cache holding URL + buffer per sticker id. We use useState (NOT useRef)
  // so React sees the Map reference but we never replace it — we mutate
  // it inside effects and bump `version` to signal change.
  const [cache] = useState<Map<string, CachedURL>>(() => new Map());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const nextIds = new Set(stickers.map(s => s.id));
    let dirty = false;
    for (const [id, { url }] of cache) {
      if (!nextIds.has(id)) {
        URL.revokeObjectURL(url);
        cache.delete(id);
        dirty = true;
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
        dirty = true;
      }
    }
    if (dirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVersion(v => v + 1);
    }
  }, [stickers, cache]);

  useEffect(() => {
    return () => {
      for (const { url } of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, [cache]);

  // Derived view: a fresh Map every time `version` changes (acceptable —
  // consumers iterate; identity comparison isn't required by Grid).
  // `version` is read so React re-runs this hook when the cache mutated.
  void version;
  const view = new Map<string, string>();
  for (const [id, { url }] of cache) view.set(id, url);
  return view;
}
