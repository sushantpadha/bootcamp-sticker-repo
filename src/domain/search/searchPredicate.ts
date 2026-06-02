import type { Sticker } from '../entities/sticker';

// Case-insensitive substring match on name + tags. Empty/whitespace query matches all.
export function buildSearchPredicate(query: string): (s: Sticker) => boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return () => true;
  return (s: Sticker) =>
    s.name.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q));
}
