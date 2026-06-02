// IDB.md §ZIP export/import format

export interface ZipStickerEntry {
  id: string;
  name: string;
  packIds: string[];
  tags: string[];
  mimeType: 'image/png' | 'image/gif' | 'image/webp';
  createdAt: number;
  lastUsedAt: number;
  file: string;             // path inside zip, e.g. "stickers/<id>.gif"
}

export interface ZipPackEntry {
  id: string;
  name: string;
  createdAt: number;
}

export interface ExportManifest {
  version: 1;
  exportedAt: number;
  packs: ZipPackEntry[];
  stickers: ZipStickerEntry[];
}

// [LSP] Both methods throw on failure (decision J).
//       files map: file-path -> ArrayBuffer.
export interface ZipCodecPort {
  pack(manifest: ExportManifest, files: Map<string, ArrayBuffer>): Promise<Blob>;
  unpack(file: File): Promise<{ manifest: ExportManifest; files: Map<string, ArrayBuffer> }>;
}
