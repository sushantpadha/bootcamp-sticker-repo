// [LSP] Both methods throw on failure; pickZip returns null only when the user
//       cancels the picker (not an error condition).
export interface FilePickerPort {
  pickImages(): Promise<File[]>;
  pickZip(): Promise<File | null>;
}
