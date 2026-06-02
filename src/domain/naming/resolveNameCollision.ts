import type { Sticker } from '../entities/sticker';

// DOMAIN.md §Decision F — naming collision algorithm contract.
//
// Returns `name` unchanged if it is already free in all target scopes.
// Otherwise appends " (2)", " (3)", … until a name is free simultaneously in
// every scope defined by targetPackIds.
//
// Scoping rules:
//   targetPackIds non-empty → name must be unique among co-members of EACH pack.
//   targetPackIds === []    → name must be unique among ungrouped stickers
//                             (stickers where packIds.length === 0).
export function resolveNameCollision(
  name: string,
  targetPackIds: string[],
  existing: Sticker[],
): string {
  const isTaken = (candidate: string): boolean => {
    if (targetPackIds.length === 0) {
      // Ungrouped scope: check stickers that have no packs.
      return existing.some(s => s.packIds.length === 0 && s.name === candidate);
    }
    // Per-pack scope: candidate must be free in every target pack.
    return targetPackIds.some(packId =>
      existing.some(s => s.packIds.includes(packId) && s.name === candidate),
    );
  };

  if (!isTaken(name)) return name;

  let n = 2;
  for (;;) {
    const candidate = `${name} (${n})`;
    if (!isTaken(candidate)) return candidate;
    n++;
  }
}
