import type { KeyValueStore } from '../ports/keyValueStore';
import type { Database, StickerRepository, PackRepository } from '../ports/database';
import type { ClipboardPort } from '../ports/clipboardPort';
import type { IdGenerator } from '../ports/idGenerator';
import type { Clock } from '../ports/clock';
import type { ZipCodecPort } from '../ports/zipCodecPort';
import type { ModeName } from '../../domain/values/modeName';
import type { KeyEvent, StatuslineModel } from '../modes/mode';
import { AppState } from './appState';
import { AllSelection } from '../../domain/selection/sidebarSelection';
import { RecentSort } from '../../domain/sort/stickerSort';
import { FlashScheduler } from './flash';
import { Intent, reduce } from './intents';
import { ModeRegistry } from '../modes/modeRegistry';
import { YankService } from '../services/yankService';
import { PackService } from '../services/packService';
import { ExportService } from '../services/exportService';
import { ImportService } from '../services/importService';

// Re-export the Engine (mode-facing) interface so callers only need one import.
export type { Engine } from './engineHandle';

// ── EngineStore — React-facing surface (STATE.md §Decision A) ─────────────────
//
// React consumes the engine exclusively through this interface via
// useSyncExternalStore (ui/useEngine.ts). It is intentionally kept narrow:
// the UI cannot call mode lifecycle methods or inspect internal FSM state.
//
// handleKey is also here because it is the bridge between the DOM event loop
// (ui/KeyboardCapture) and the mode FSM — it is not a dispatch (no new state by
// itself) but it routes key events through the current mode, which may dispatch.
export interface EngineStore {
  getSnapshot(): AppState;
  subscribe(listener: () => void): () => void;
  dispatch(intent: Intent): void;

  // Routes a normalized key event to the active mode (MODES.md §keydown path).
  // Called by ui/KeyboardCapture after DOM normalization (M12).
  handleKey(evt: KeyEvent): void;

  // Returns the active mode's StatuslineModel (MODES.md §Decision C).
  // Called by ui/Statusline during render; consistent with the current snapshot.
  getStatuslineModel(): StatuslineModel;
}

// ── Ports required by the engine ──────────────────────────────────────────────
export interface EnginePorts {
  kv: KeyValueStore;
  // M8 service ports — optional. When absent, IDB-touching intents remain
  // no-ops (M7 behaviour preserved; existing tests continue to pass).
  db?: Database;
  stickers?: StickerRepository;
  packs?: PackRepository;
  clipboard?: ClipboardPort;
  idGen?: IdGenerator;
  clock?: Clock;
  zip?: ZipCodecPort;
  onDownloadFallback?: (blob: Blob, name: string) => void;
}

// Bundle of instantiated services created when IDB ports are present.
interface Services {
  yank: YankService;
  pack: PackService;
  export: ExportService;
  import: ImportService;
}

const FLASH_DURATION_MS = 2000;
const THEME_KEY = 'theme';

function buildServices(ports: EnginePorts): Services | null {
  if (!ports.db || !ports.stickers || !ports.packs || !ports.clipboard ||
      !ports.idGen || !ports.clock || !ports.zip) {
    return null;
  }
  return {
    yank:   new YankService(ports.clipboard, ports.db, ports.stickers, ports.clock, ports.onDownloadFallback),
    pack:   new PackService(ports.db, ports.packs, ports.stickers, ports.idGen, ports.clock),
    export: new ExportService(ports.zip),
    import: new ImportService(ports.db, ports.stickers, ports.packs, ports.idGen, ports.clock, ports.zip),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
    modeName: 'NORMAL',
    statusInput: '',
    uploadQueue: [],
    flash: null,
    theme: loadTheme(kv),
  };
}

// ── EngineImpl ─────────────────────────────────────────────────────────────────
//
// Implements both EngineStore (React-facing) and Engine (mode-facing).
//
// The two surfaces are distinct by design:
//   EngineStore  — what the UI sees: snapshot, subscribe, dispatch, handleKey.
//   Engine       — what modes see:   snapshot, dispatch, transitionTo, flash,
//                  getStatusInput, setStatusInput. No subscribe; modes are never
//                  store consumers.
//
// Modes receive `this` cast to the Engine interface; they never see EngineImpl.
// Minimal registry shape the engine depends on — satisfied by ModeRegistry and
// by inline test doubles without requiring ModeRegistry to be a concrete dep.
export interface IModeRegistry {
  get(name: ModeName): import('../modes/mode').Mode | null;
}

export class EngineImpl implements EngineStore {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private readonly flashScheduler = new FlashScheduler();
  private readonly registry: IModeRegistry;
  private readonly svc: Services | null;

  // The optional `registry` parameter lets tests inject a spy registry without
  // touching the real ModeRegistry.
  constructor(private readonly ports: EnginePorts, registry?: IModeRegistry) {
    this.state = buildInitialState(ports.kv);
    this.registry = registry ?? new ModeRegistry();
    this.svc = buildServices(ports);
  }

  // ── EngineStore ───────────────────────────────────────────────────────────────

  getSnapshot(): AppState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispatch(intent: Intent): void {
    // Flash side-effect: schedule the 2-second clear timer (STATE.md §Flash).
    if (intent.type === 'flash') {
      this.flashScheduler.schedule(FLASH_DURATION_MS, () => {
        this.dispatch({ type: 'clearFlash' });
      });
    }

    // Theme persistence (decision D — only theme persists via KeyValueStore).
    if (intent.type === 'setTheme') {
      this.ports.kv.set(THEME_KEY, intent.theme);
    }

    // Service routing — IDB-touching intents are fire-and-forget async calls.
    // When ports.db is absent (M1–M7 path), these remain no-ops in the reducer.
    if (this.svc) {
      switch (intent.type) {
        case 'yankFocused':   this.handleYankFocused();              break;
        case 'deleteFocused': this.handleDeleteFocused();            break;
        case 'renameFocused': this.handleRenameFocused(intent.name); break;
        case 'setTags':       this.handleSetTags(intent.tags);       break;
        case 'assignPacks':   this.handleAssignPacks(intent.packNames); break;
        case 'saveUpload':    this.handleSaveUpload();               break;
      }
    }

    const next = reduce(this.state, intent);
    if (next !== this.state) {
      this.state = next;
      this.notify();
    }
  }

  // Routes a normalized DOM key event to the current mode (MODES.md §keydown path).
  // The path is literally: currentMode.handleKey(evt, engine).
  handleKey(evt: KeyEvent): void {
    const mode = this.registry.get(this.state.modeName);
    if (mode === null) return; // mode not yet registered (M6+)
    mode.handleKey(evt, this.asEngineHandle());
  }

  getStatuslineModel(): StatuslineModel {
    const mode = this.registry.get(this.state.modeName);
    if (mode === null) return { mode: this.state.modeName };
    return mode.statusline(this.asEngineHandle());
  }

  // ── Engine handle (mode-facing) ───────────────────────────────────────────────
  //
  // Returns `this` typed as the Engine interface so modes cannot reach EngineImpl
  // internals (subscribe, registry, etc.).

  private asEngineHandle() {
    // Inline object that satisfies Engine without exposing EngineImpl.
    // Using an arrow-function closure captures `this` correctly.
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

  // ── Mode FSM ──────────────────────────────────────────────────────────────────

  // Atomically transitions from the current mode to the named mode
  // (MODES.md §Decision B):  current.onExit → set modeName → next.onEnter
  //
  // If the target mode is not yet registered (M6+), an error flash is shown and
  // the current mode remains active. This keeps the acceptance criteria for M5
  // (NORMAL only) from throwing at runtime when keys like '/' are pressed.
  private transitionTo(name: ModeName): void {
    if (this.state.modeName === name) return; // already in target mode

    const next = this.registry.get(name);
    if (next === null) {
      this.setFlash(`mode ${name} not yet implemented`, true);
      return;
    }

    const current = this.registry.get(this.state.modeName);
    const handle = this.asEngineHandle();

    // Step 1: exit current mode (clears its transient buffers / statusInput).
    current?.onExit(handle);

    // Step 2: commit the mode name change to AppState.
    this.dispatch({ type: 'transitionMode', modeName: name });

    // Step 3: enter the new mode (may prefill statusInput, set hints, etc.).
    next.onEnter(handle);
  }

  // ── Engine helpers (called by the handle closure) ─────────────────────────────

  private setFlash(text: string, isError: boolean): void {
    this.dispatch({ type: 'flash', text, isError });
  }

  private getStatusInput(): string {
    return this.state.statusInput;
  }

  private setStatusInput(s: string): void {
    this.dispatch({ type: 'setStatusInput', value: s });
  }

  // ── Service handlers (fire-and-forget async; errors become flash messages) ────

  private handleYankFocused(): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc!.yank.yank(sticker)
      .then(updated => this.dispatch({ type: 'applySticker', sticker: updated }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleDeleteFocused(): void {
    const id = this.state.focusId;
    if (!id) return;
    this.svc!.yank.deleteSticker(id)
      .then(() => this.dispatch({ type: 'removeSticker', id }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleRenameFocused(name: string): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc!.yank.renameSticker(sticker, name, this.state.stickers)
      .then(updated => this.dispatch({ type: 'applySticker', sticker: updated }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleSetTags(tags: string[]): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc!.yank.setTags(sticker, tags)
      .then(updated => this.dispatch({ type: 'applySticker', sticker: updated }))
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleAssignPacks(packNames: string[]): void {
    const sticker = this.state.stickers.find(s => s.id === this.state.focusId);
    if (!sticker) return;
    this.svc!.pack.assignPacks(sticker, packNames, this.state.packs, this.state.stickers)
      .then(({ sticker: updated, newPacks }) => {
        this.dispatch({ type: 'applySticker', sticker: updated });
        for (const p of newPacks) this.dispatch({ type: 'applyPack', pack: p });
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  private handleSaveUpload(): void {
    const { uploadQueue, stickers, packs } = this.state;
    this.svc!.import.saveUpload(uploadQueue, stickers, packs)
      .then(({ stickers: newStickers, newPacks }) => {
        this.dispatch({ type: 'applyStickers', stickers: newStickers });
        for (const p of newPacks) this.dispatch({ type: 'applyPack', pack: p });
        this.dispatch({ type: 'clearUploadQueue' });
      })
      .catch((err: unknown) => this.setFlash(`E: ${errorMessage(err)}`, true));
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}
