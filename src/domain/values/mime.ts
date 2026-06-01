export type SupportedMime = 'image/png' | 'image/gif' | 'image/webp';

export const mimeExtension: Record<SupportedMime, string> = {
  'image/png':  '.png',
  'image/gif':  '.gif',
  'image/webp': '.webp',
};
