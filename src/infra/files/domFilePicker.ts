import type { FilePickerPort } from '../../app/ports/filePickerPort';

export class DomFilePicker implements FilePickerPort {
  pickImages(): Promise<File[]> {
    return this.pick('image/png,image/gif,image/webp', true);
  }

  pickZip(): Promise<File | null> {
    return this.pick('.zip', false).then(files => files[0] ?? null);
  }

  private pick(accept: string, multiple: boolean): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.style.display = 'none';

      const onChange = () => {
        document.body.removeChild(input);
        resolve(input.files ? Array.from(input.files) : []);
      };
      input.addEventListener('change', onChange, { once: true });

      document.body.appendChild(input);
      input.click();
    });
  }
}
