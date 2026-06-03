import JSZip from 'jszip';
import type { ZipCodecPort, ExportManifest } from '../../app/ports/zipCodecPort';

export class JsZipCodec implements ZipCodecPort {
  async pack(manifest: ExportManifest, files: Map<string, ArrayBuffer>): Promise<Blob> {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    for (const [path, buffer] of files) {
      zip.file(path, buffer);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  async unpack(file: File): Promise<{ manifest: ExportManifest; files: Map<string, ArrayBuffer> }> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Invalid zip: missing manifest.json');

    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText) as ExportManifest;

    const files = new Map<string, ArrayBuffer>();
    for (const entry of manifest.stickers) {
      const zipFile = zip.file(entry.file);
      if (!zipFile) throw new Error(`Invalid zip: missing file ${entry.file}`);
      files.set(entry.file, await zipFile.async('arraybuffer'));
    }

    return { manifest, files };
  }
}
