import type { ZipCodecPort, ExportManifest } from '../../app/ports/zipCodecPort';

// Encodes manifest + file bytes as JSON inside a Blob for round-trip testing.
// Not a real zip; matches the new schema (file paths under stickers/).
export class FakeZipCodec implements ZipCodecPort {
  async pack(manifest: ExportManifest, files: Map<string, ArrayBuffer>): Promise<Blob> {
    const serialised = {
      manifest,
      files: Object.fromEntries(
        [...files.entries()].map(([path, buf]) => [path, Array.from(new Uint8Array(buf))]),
      ),
    };
    return new Blob([JSON.stringify(serialised)], { type: 'application/json' });
  }

  async unpack(file: File): Promise<{ manifest: ExportManifest; files: Map<string, ArrayBuffer> }> {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      manifest: ExportManifest;
      files: Record<string, number[]>;
    };
    const files = new Map<string, ArrayBuffer>(
      Object.entries(parsed.files).map(([path, bytes]) => [
        path,
        new Uint8Array(bytes).buffer,
      ]),
    );
    return { manifest: parsed.manifest, files };
  }
}
