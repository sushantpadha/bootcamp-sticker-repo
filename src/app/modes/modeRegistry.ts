import type { Mode } from './mode';
import type { ModeName } from '../../domain/values/modeName';
import { NormalMode } from './normalMode';

// ── ModeRegistry ──────────────────────────────────────────────────────────────
//
// Holds one singleton Mode instance per registered ModeName. The engine calls
// get() when entering or exiting a mode during transitionTo().
//
// M5 registers NORMAL only. M6 adds SEARCH, COMMAND, CONFIRM, RENAME, TAGS,
// PACKASSIGN, UPLOAD, HELP. Unregistered modes return null so the engine can
// flash an error and stay put rather than crashing.
export class ModeRegistry {
  private readonly modes: ReadonlyMap<ModeName, Mode>;

  constructor() {
    this.modes = new Map<ModeName, Mode>([
      ['NORMAL', new NormalMode()],
      // M6: remaining modes registered here
    ]);
  }

  // Returns the Mode for name, or null if not yet registered.
  get(name: ModeName): Mode | null {
    return this.modes.get(name) ?? null;
  }
}
