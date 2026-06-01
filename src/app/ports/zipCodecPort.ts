// Serialisable metadata carried in the zip manifest (no ArrayBuffer; bytes are
// separate entries keyed by filename).
export interface ZipManifestEntry {
  id: string;
  name: string;
  packIds: string[];
  tags: string[];
  mimeType: string;
  createdAt: number;
  lastUsedAt: number;
  filename: string; // relative path of the image file inside the zip
}

export interface ZipPackEntry {
  id: string;
  name: string;
  createdAt: number;
}

export interface ZipManifest {
  version: 1;
  stickers: ZipManifestEntry[];
  packs: ZipPackEntry[];
}

// [LSP] Both methods throw on failure (decision J).
//       files map: filename -> ArrayBuffer (no Blob; Application layer owns Blob↔AB conversions).
export interface ZipCodecPort {
  pack(manifest: ZipManifest, files: Map<string, ArrayBuffer>): Promise<Blob>;
  unpack(file: File): Promise<{ manifest: ZipManifest; files: Map<string, ArrayBuffer> }>;
}
