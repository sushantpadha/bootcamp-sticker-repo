import type { AppState } from './appState';
import type { Intent } from './intents';
import type { ModeName } from '../../domain/values/modeName';
import type { Database, StickerRepository, PackRepository } from '../ports/database';
import type { ZipCodecPort } from '../ports/zipCodecPort';
import type { FilePickerPort } from '../ports/filePickerPort';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import type { PackService } from '../services/packService';
import type { TagService } from '../services/tagService';
import type { ExportService } from '../services/exportService';
import type { ImportService } from '../services/importService';

// CommandContext is the richer engine surface passed to Command.run().
// Commands need access to services (for IDB-touching operations) and ports
// (for file picker, zip, idGen, clock). Modes get the narrower `Engine`
// handle (engineHandle.ts) that doesn't expose services/ports directly.
//
// This split keeps modes uniformly substitutable (they only see snapshot +
// dispatch + transition + flash + statusInput) while letting commands do
// complex orchestration (export reads all stickers, builds zip, triggers
// download).

export interface CommandContextPorts {
  db: Database;
  stickers: StickerRepository;
  packs: PackRepository;
  zip: ZipCodecPort;
  filePicker: FilePickerPort;
  idGen: IdGenerator;
  clock: Clock;
  downloadBlob: (blob: Blob, filename: string) => void;
}

export interface CommandContextServices {
  pack: PackService;
  tag: TagService;
  export: ExportService;
  import: ImportService;
}

export interface CommandContext {
  getSnapshot(): AppState;
  dispatch(intent: Intent): void;
  transitionTo(name: ModeName): void;
  setFlash(text: string, isError: boolean): void;
  setStatusInput(s: string): void;
  ports: CommandContextPorts;
  services: CommandContextServices;
}
