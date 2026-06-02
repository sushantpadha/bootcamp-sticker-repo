import type { FilePickerPort } from '../../app/ports/filePickerPort';

export class FakeFilePicker implements FilePickerPort {
  // Tests may pre-load these to simulate picker responses.
  nextImages: File[] = [];
  nextZip: File | null = null;

  async pickImages(): Promise<File[]> {
    const result = this.nextImages;
    this.nextImages = [];
    return result;
  }

  async pickZip(): Promise<File | null> {
    const result = this.nextZip;
    this.nextZip = null;
    return result;
  }
}
