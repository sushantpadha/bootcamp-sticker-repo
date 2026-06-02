import type { SupportedMime } from '../../domain/values/mime';

// Set of mime types accepted by the upload boundary. APNG is included for
// browsers that report it as image/apng; it gets coerced to image/png per
// DOMAIN.md §Decision G ("APNG is stored as image/png").
const ACCEPTED_MIMES = new Set([
  'image/png',
  'image/gif',
  'image/webp',
  'image/apng',
]);

export function isAcceptedUploadMime(type: string): boolean {
  return ACCEPTED_MIMES.has(type);
}

// Normalize the incoming browser mime to a canonical SupportedMime.
// APNG → image/png (per DOMAIN.md decision G).
// Throws on unsupported input (callers should check isAcceptedUploadMime first).
export function coerceUploadMime(type: string): SupportedMime {
  switch (type) {
    case 'image/apng':
    case 'image/png':  return 'image/png';
    case 'image/gif':  return 'image/gif';
    case 'image/webp': return 'image/webp';
    default:
      throw new Error(`Unsupported upload mime: ${type}`);
  }
}

// `accept` string for <input type="file"> and file picker.
export const UPLOAD_ACCEPT = 'image/png,image/gif,image/webp,image/apng';
