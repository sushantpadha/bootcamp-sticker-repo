import type { KeyValueStore } from '../ports/keyValueStore';
import type { ModeName } from '../../domain/values/modeName';
import type { KeyEvent } from '../modes/mode';
import { AppState } from './appState';
import { AllSelection } from '../../domain/selection/sidebarSelection';
import { RecentSort } from '../../domain/sort/stickerSort';
import { FlashScheduler } from './flash';
import { Intent, reduce } from './intents';
import { ModeRegistry } from '../modes/modeRegistry';

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
}

// ── Ports required by the engine ──────────────────────────────────────────────
export interface EnginePorts {
  kv: KeyValueStore;
  // Additional ports (clipboard, db, repos, idGen) injected here in M8 when
  // services are wired. The engine itself never calls them directly.
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
export class EngineImpl implements EngineStore {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private readonly flashScheduler = new FlashScheduler();
  private readonly registry: ModeRegistry;

  constructor(private readonly ports: EnginePorts) {
    this.state = buildInitialState(ports.kv);
    this.registry = new ModeRegistry();
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

  // ── Private ───────────────────────────────────────────────────────────────────

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}
