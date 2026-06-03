// DOMAIN.md §Tab-completion helper.
//
// Replaces the current comma-separated token in `input` with the first
// candidate that case-insensitively startsWith it (and is not equal to it).
// Returns `input` unchanged on no match.
//
// Used by:
//   - COMMAND mode first-token autocomplete
//   - PACKASSIGN statusline token autocomplete
//   - UploadModal queue row pack-input autocomplete
//
// Pure, deterministic, no IDB, no clock.
export function completeToken(input: string, candidates: string[]): string {
  const lastComma = input.lastIndexOf(',');
  const prefix = lastComma >= 0 ? input.slice(0, lastComma + 1) + ' ' : '';
  const tokenRaw = lastComma >= 0 ? input.slice(lastComma + 1) : input;
  const token = tokenRaw.trim();
  if (token.length === 0) return input;

  const lower = token.toLowerCase();
  const match = candidates.find(
    c => c.toLowerCase().startsWith(lower) && c !== token,
  );
  if (match === undefined) return input;

  return prefix + match;
}
