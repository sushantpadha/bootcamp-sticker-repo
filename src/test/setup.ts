// Polyfill File for Node 18, which lacks the global File constructor.
// Node 20 has it natively; vitest.config.ts targets Node 18 compatibility.
import { File as NodeFile } from 'node:buffer';
if (!('File' in globalThis)) {
  (globalThis as Record<string, unknown>).File = NodeFile;
}
