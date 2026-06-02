import type { KeyValueStore } from '../ports/keyValueStore';
import type { ModeName } from '../../domain/values/modeName';
import { AppState } from './appState';
import { AllSelection } from '../../domain/selection/sidebarSelection';
import { RecentSort } from '../../domain/sort/stickerSort';
import { FlashScheduler } from './flash';
import { Intent, reduce } from './intents';

// ── React-facing store (decision A — useSyncExternalStore contract) ───────────
export interface EngineStore {
  getSnapshot(): AppState;
  subscribe(listener: () => void): () => void;
  dispatch(intent: Intent): void;
}

// ── Mode-facing handle (MODES.md §mode-facing engine handle) ──────────────────
// Modes receive this interface; they never see EngineImpl directly.
// transitionTo is implemented as a simple modeName setter here (M4); M5 extends it
// with onExit → set modeName → onEnter lifecycle.
export interface Engine {
  getSnapshot(): AppState;
  dispatch(intent: Intent): void;
  transitionTo(name: ModeName): void;
  setFlash(text: string, isError: boolean): void;
  getStatusInput(): string;
  setStatusInput(s: string): void;
}

// ── Ports required by the engine ──────────────────────────────────────────────
export interface EnginePorts {
  kv: KeyValueStore;
  // Additional ports (clipboard, db, repos, idGen) injected here in M8 when services
  // are wired. They are passed through to services; the engine itself does not call
  // them directly (composition-root rule: wiring happens at bootstrap/composition.ts).
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

// ── Implementation ─────────────────────────────────────────────────────────────
export class EngineImpl implements EngineStore, Engine {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private readonly flashScheduler = new FlashScheduler();

  constructor(private readonly ports: EnginePorts) {
    this.state = buildInitialState(ports.kv);
  }

  // ── EngineStore ──

  getSnapshot(): AppState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispatch(intent: Intent): void {
    // Flash intents need a side-effect (timer); handle them before the reducer.
    if (intent.type === 'flash') {
      this.flashScheduler.schedule(FLASH_DURATION_MS, () => {
        this.dispatch({ type: 'clearFlash' });
      });
    }

    // Theme persistence (decision D — only theme persists).
    if (intent.type === 'setTheme') {
      this.ports.kv.set(THEME_KEY, intent.theme);
    }

    const next = reduce(this.state, intent);
    if (next !== this.state) {
      this.state = next;
      this.notify();
    }
  }

  // ── Engine (mode-facing) ──

  // M4: simple modeName setter. M5 extends this to run onExit → set → onEnter.
  transitionTo(name: ModeName): void {
    this.dispatch({ type: 'transitionMode', modeName: name });
  }

  setFlash(text: string, isError: boolean): void {
    this.dispatch({ type: 'flash', text, isError });
  }

  getStatusInput(): string {
    return this.state.statusInput;
  }

  setStatusInput(s: string): void {
    this.dispatch({ type: 'setStatusInput', value: s });
  }

  // ── Private ──

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}
