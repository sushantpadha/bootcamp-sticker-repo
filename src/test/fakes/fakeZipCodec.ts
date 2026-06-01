import type { ZipCodecPort, ZipManifest } from '../../app/ports/zipCodecPort';

// Encodes the manifest and file bytes as JSON inside a Blob for round-trip
// testing. Not a real zip — only for fake/test use.
export class FakeZipCodec implements ZipCodecPort {
  async pack(manifest: ZipManifest, files: Map<string, ArrayBuffer>): Promise<Blob> {
    const serialised = {
      manifest,
      files: Object.fromEntries(
        [...files.entries()].map(([name, buf]) => [name, Array.from(new Uint8Array(buf))]),
      ),
    };
    return new Blob([JSON.stringify(serialised)], { type: 'application/json' });
  }

  async unpack(file: File): Promise<{ manifest: ZipManifest; files: Map<string, ArrayBuffer> }> {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      manifest: ZipManifest;
      files: Record<string, number[]>;
    };
    const files = new Map<string, ArrayBuffer>(
      Object.entries(parsed.files).map(([name, bytes]) => [
        name,
        new Uint8Array(bytes).buffer,
      ]),
    );
    return { manifest: parsed.manifest, files };
  }
}
