import JSZip from 'jszip';
import type { ZipCodecPort, ZipManifest } from '../../app/ports/zipCodecPort';

export class JsZipCodec implements ZipCodecPort {
  async pack(manifest: ZipManifest, files: Map<string, ArrayBuffer>): Promise<Blob> {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest));
    for (const [filename, buffer] of files) {
      zip.file(filename, buffer);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  async unpack(file: File): Promise<{ manifest: ZipManifest; files: Map<string, ArrayBuffer> }> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Invalid zip: missing manifest.json');

    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText) as ZipManifest;

    const files = new Map<string, ArrayBuffer>();
    for (const entry of manifest.stickers) {
      const zipFile = zip.file(entry.filename);
      if (!zipFile) throw new Error(`Invalid zip: missing file ${entry.filename}`);
      files.set(entry.filename, await zipFile.async('arraybuffer'));
    }

    return { manifest, files };
  }
}
