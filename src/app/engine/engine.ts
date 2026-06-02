import type { KeyValueStore } from '../ports/keyValueStore';
import type { Database, StickerRepository, PackRepository } from '../ports/database';
import type { ClipboardPort } from '../ports/clipboardPort';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import type { Timer } from '../ports/timer';
import type { ZipCodecPort } from '../ports/zipCodecPort';
import type { FilePickerPort } from '../ports/filePickerPort';
import type { ModeName } from '../../domain/values/modeName';
import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from '../modes/mode';
import type { AppState } from './appState';
import { AllSelection } from '../../domain/selection/sidebarSelection';
import { RecentSort } from '../../domain/sort/stickerSort';
import { FlashScheduler } from './flash';
import { type Intent, type EngineInternalChange, type AnyChange, reduce } from './intents';
import { ModeRegistry } from '../modes/modeRegistry';
import { YankService } from '../services/yankService';
import { PackService } from '../services/packService';
import { TagService } from '../services/tagService';
import { ExportService } from '../services/exportService';
import { ImportService } from '../services/importService';
import { mimeExtension } from '../../domain/values/mime';
import { FAVOURITE_TAG } from '../../domain/values/favouriteTag';
import type { CommandContext } from './commandContext';

export type { Engine } from './engineHandle';

// ── EngineStore — React-facing surface (STATE.md §Decision A) ─────────────────
export interface EngineStore {
  getSnapshot(): AppState;
  subscribe(listener: () => void): () => void;
  dispatch(intent: Intent): void;
  handleKey(evt: KeyEvent): void;
  getStatuslineModel(): StatuslineModel;
  getOverlayModel(): OverlayModel | null;
}

// ── Ports required by the engine ──────────────────────────────────────────────
export interface EnginePorts {
  kv: KeyValueStore;
  timer: Timer;
  db: Database;
  stickers: StickerRepository;
  packs: PackRepository;
  clipboard: ClipboardPort;
  idGen: IdGenerator;
  clock: Clock;
  zip: ZipCodecPort;
  filePicker: FilePickerPort;
  downloadBlob: (blob: Blob, filename: string) => void;
}

interface Services {
  yank: YankService;
  pack: PackService;
  tag: TagService;
  export: ExportService;
  import: ImportService;
}

const FLASH_DURATION_MS = 2000;
const THEME_KEY = 'theme';

function loadTheme(kv: KeyValueStore): 'dark' | 'light' {
  const saved = kv.get(THEME_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

function buildInitialState(kv: KeyValueStore): AppState {
  return {
    stickers: [],
    packs: [],
    selection: new AllSelection(),
    sort: RecentSort,
    search: '',
    focusId: null,
    gridCols: 1,
    modeName: 'NORMAL',
    statusInput: '',
    uploadQueue: [],
    flash: null,
    theme: loadTheme(kv),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Minimal registry shape the engine depends on.
export interface IModeRegistry {
  get(name: ModeName): Mode | null;
}

export class EngineImpl implements EngineStore {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private readonly flashScheduler: FlashScheduler;
  private readonly registry: IModeRegistry;
  private readonly svc: Services;
  private readonly ports: EnginePorts;

  // Suppresses notify() during transitionTo so subscribers see one snapshot
  // per transition rather than three intermediates (MODES.md decision B).
  private batching = false;
  private dirty = false;

  constructor(ports: EnginePorts, registry?: IModeRegistry) {
    this.ports = ports;
    this.state = buildInitialState(ports.kv);
    this.flashScheduler = new FlashScheduler(ports.timer);
    this.svc = {
      yank:   new YankService(ports.clipboard, ports.db, ports.stickers, ports.clock, ports.downloadBlob),
      pack:   new PackService(ports.db, ports.packs, ports.stickers, ports.idGen, ports.clock),
      tag:    new TagService(ports.db, ports.stickers),
      export: new ExportService(ports.zip, ports.clock),
      import: new ImportService(ports.db, ports.stickers, ports.packs, ports.zip),
    };
    this.registry = registry ?? new ModeRegistry(() => this.makeCommandContext(), ports.timer);
  }

  // ── EngineStore ───────────────────────────────────────────────────────────────

  getSnapshot(): AppState { return this.state; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispatch(intent: Intent): void {
    try {
      this.routeIntent(intent);
      this.applyChange(intent);
    } catch (err) {
      this.setFlash(`E: ${errorMessage(err)}`, true);
    }
  }

  handleKey(evt: KeyEvent): void {
    try {
      const mode = this.registry.get(this.state.modeName);
      if (mode === null) return;
      mode.handleKey(evt, this.asEngineHandle());
    } catch (err) {
      this.setFlash(`E: ${errorMessage(err)}`, true);
    }
  }

  getStatuslineModel(): StatuslineModel {
    try {
      const mode = this.registry.get(this.state.modeName);
      if (mode === null) return { mode: this.state.modeName };
      return mode.statusline(this.asEngineHandle());
    } catch {
      return { mode: this.state.modeName };
    }
  }

  getOverlayModel(): OverlayModel | null {
    try {
      const mode = this.registry.get(this.state.modeName);
      if (mode === null) return null;
      return mode.overlay(this.asEngineHandle());
    } catch {
      return null;
    }
  }

  // ── Engine handle (mode-facing) ───────────────────────────────────────────────
  private asEngineHandle() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      getSnapshot:    () => self.getSnapshot(),
      dispatch:       (i: Intent) => self.dispatch(i),
      transitionTo:   (name: ModeName) => self.transitionTo(name),
      setFlash:       (text: string, isError: boolean) => self.setFlash(text, isError),
      getStatusInput: () => self.getStatusInput(),
      setStatusInput: (s: string) => self.setStatusInput(s),
    };
  }

  // Command context passed to commands (broader surface than mode handle).
  private makeCommandContext(): CommandContext {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      getSnapshot:    () => self.getSnapshot(),
      dispatch:       (i: Intent) => self.dispatch(i),
      transitionTo:   (name: ModeName) => self.transitionTo(name),
      setFlash:       (text: string, isError: boolean) => self.setFlash(text, isError),
      setStatusInput: (s: string) => self.setStatusInput(s),
      ports: {
        db: self.ports.db,
        stickers: self.ports.stickers,
        packs: self.ports.packs,
        zip: self.ports.zip,
        filePicker: self.ports.filePicker,
        idGen: self.ports.idGen,
        clock: self.ports.clock,
        downloadBlob: self.ports.downloadBlob,
      },
      services: {
        pack: self.svc.pack,
        tag: self.svc.tag,
        export: self.svc.export,
        import: self.svc.import,
      },
    };
  }

  // ── Mode FSM ──────────────────────────────────────────────────────────────────
  private transitionTo(name: ModeName): void {
    if (this.state.modeName === name) return;
    const next = this.registry.get(name);
    if (next === null) {
      throw new Error(`ModeRegistry missing mode: ${name}`);
    }
    const current = this.registry.get(this.state.modeName);
    const handle = this.asEngineHandle();

    // Batch the three steps so subscribers see one snapshot after the
    // transition (MODES.md §Decision B).
    this.batching = true;
    try {
      current?.onExit(handle);
      this.applyChange({ type: 'transitionMode', modeName: name });
      next.onEnter(handle);
    } finally {
      this.batching = false;
      if (this.dirty) {
        this.dirty = false;
        this.notify();
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private setFlash(text: string, isError: boolean): void {
    this.applyChange({ type: 'flash', text, isError });
    this.flashScheduler.schedule(FLASH_DURATION_MS, () => {
      this.applyChange({ type: 'clearFlash' });
    });
  }

  private getStatusInput(): string { return this.state.statusInput; }
  private setStatusInput(s: string): void {
    this.applyChange({ type: 'setStatusInput', value: s });
  }

  // ── Intent routing (IDB-touching) ──────────────────────────────────────────
  private routeIntent(intent: Intent): void {
    switch (intent.type) {
      case 'setTheme':
        this.ports.kv.set(THEME_KEY, intent.theme);
        return;
      case 'yankFocused':      this.handleYankFocused();      return;
      case 'deleteFocused':    this.handleDeleteFocused();    return;
      case 'renameFocused':    this.handleRenameFocused(intent.name); return;
      case 'setTags':          this.handleSetTags(intent.tags); return;
      case 'assignPacks':      this.handleAssignPacks(intent.packNames); return;
      case 'toggleFavourite':  this.handleToggleFavourite();  return;
      case 'saveUpload':       this.handleSaveUpload();       return;
      default: return;
    }
  }

  // ── Service handlers (fire-and-forget; errors become flashes) ──────────────
  private handleYankFocused(): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc.yank.yank(sticker)
      .then(result => {
        this.applyChange({ type: 'applySticker', sticker: result.sticker });
        const ext = mimeExtension[sticker.mimeType];
        if (result.downloaded) {
          this.setFlash('(no clipboard: downloading)', false);
        } else {
          this.setFlash(`yanked: ${sticker.name}${ext}`, false);
        }
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleDeleteFocused(): void {
    const id = this.state.focusId;
    if (!id) return;
    this.svc.yank.deleteSticker(id)
      .then(() => this.applyChange({ type: 'removeSticker', id }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleRenameFocused(name: string): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc.yank.renameSticker(sticker, name, this.state.stickers)
      .then(updated => {
        this.applyChange({ type: 'applySticker', sticker: updated });
        this.setFlash(`renamed: ${updated.name}`, false);
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleSetTags(tags: string[]): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc.yank.setTags(sticker, tags)
      .then(updated => this.applyChange({ type: 'applySticker', sticker: updated }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleAssignPacks(packNames: string[]): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc.pack.assignPacks(sticker, packNames, this.state.packs, this.state.stickers)
      .then(({ sticker: updated, newPacks }) => {
        this.applyChange({ type: 'applySticker', sticker: updated });
        for (const p of newPacks) this.applyChange({ type: 'applyPack', pack: p });
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleToggleFavourite(): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    const has = sticker.tags.includes(FAVOURITE_TAG);
    const tags = has
      ? sticker.tags.filter(t => t !== FAVOURITE_TAG)
      : [...sticker.tags, FAVOURITE_TAG];
    this.svc.yank.setTags(sticker, tags)
      .then(updated => {
        this.applyChange({ type: 'applySticker', sticker: updated });
        this.setFlash(has ? `untagged: ${FAVOURITE_TAG}` : `tagged: ${FAVOURITE_TAG}`, false);
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleSaveUpload(): void {
    const { uploadQueue, stickers, packs } = this.state;
    const count = uploadQueue.length;
    if (count === 0) return;
    this.svc.import.saveUpload(uploadQueue, stickers, packs, this.ports.idGen, this.ports.clock)
      .then(({ stickers: newStickers, newPacks }) => {
        this.applyChange({ type: 'applyStickers', stickers: newStickers });
        for (const p of newPacks) this.applyChange({ type: 'applyPack', pack: p });
        this.applyChange({ type: 'clearUploadQueue' });
        this.setFlash(`added: ${newStickers.length} stickers`, false);
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  // ── State application + notify ────────────────────────────────────────────────
  // Engine-internal apply path. Used by both public dispatch() (after routing)
  // and by service-resolution callbacks.
  private applyChange(change: AnyChange): void {
    const next = reduce(this.state, change);
    if (next !== this.state) {
      this.state = next;
      if (this.batching) this.dirty = true;
      else this.notify();
    }
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}

