import type { AppState } from './appState';
import type { Intent } from './intents';
import type { ModeName } from '../../domain/values/modeName';

// ── Mode-facing engine handle (MODES.md §mode-facing engine handle) ───────────
//
// This interface lives in a separate file to break the circular import that would
// arise if modes imported Engine directly from engine.ts while engine.ts imports
// ModeRegistry from modes/:
//
//   engine.ts  →  modes/modeRegistry.ts  →  modes/mode.ts  →  engine.ts  ✗
//
// By splitting the interface here, modes depend only on engineHandle.ts and
// domain/**, while engine.ts depends on modes/** without forming a cycle.
//
// The Engine handle is intentionally narrower than EngineStore (STATE.md §Decision A):
// modes can read snapshot and mutate state through dispatch/transition/flash/input,
// but they never subscribe to the store — that is purely a React concern.
export interface Engine {
  // Read the current snapshot (always the latest committed state).
  getSnapshot(): AppState;

  // The sole mutation entry point: dispatch an intent from the catalog (STATE.md).
  dispatch(intent: Intent): void;

  // Atomically exit the current mode and enter the named mode (MODES.md §Decision B).
  transitionTo(name: ModeName): void;

  // Schedule a 2-second flash message (STATE.md §Flash scheduling).
  setFlash(text: string, isError: boolean): void;

  // Engine-owned statusline input buffer (MODES.md §Decision I).
  getStatusInput(): string;
  setStatusInput(s: string): void;
}
