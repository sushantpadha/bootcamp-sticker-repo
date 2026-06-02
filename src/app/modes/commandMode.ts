import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import type { CommandRegistry } from '../commands/registry';

// ── CommandMode ────────────────────────────────────────────────────────────────
//
// Ex-style command entry. Receives a CommandRegistry (injected by ModeRegistry)
// that resolves and executes commands on Enter.
//
// enter/exit table (MODES.md):
//   onEnter  — statusInput ← ""
//   onExit   — statusInput cleared
//
// Key bindings:
//   printable char   — append to buffer
//   Backspace        — delete last char; if buffer empty, exit to NORMAL
//   Enter            — run command via registry, then transition to NORMAL
//                      (skipped if the command itself changed the mode)
//   Escape           — discard buffer, transition to NORMAL
export class CommandMode implements Mode {
  readonly name = 'COMMAND' as const;

  constructor(private readonly registry: CommandRegistry) {}

  onEnter(engine: Engine): void {
    engine.setStatusInput('');
  }

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    evt.preventDefault();

    if (key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }

    if (key === 'Enter') {
      const input = engine.getStatusInput();
      const modeBefore = engine.getSnapshot().modeName;
      const outcome = this.registry.run(input, engine);
      if (outcome.flash !== undefined) {
        engine.setFlash(outcome.flash, !outcome.ok);
      }
      // Only return to NORMAL if the command didn't itself trigger a mode change
      // (e.g. :help transitions to HELP rather than back to NORMAL).
      if (engine.getSnapshot().modeName === modeBefore) {
        engine.transitionTo('NORMAL');
      }
      return;
    }

    if (!ctrl && !alt && !meta) {
      if (key === 'Backspace') {
        const cur = engine.getStatusInput();
        if (cur.length === 0) {
          engine.transitionTo('NORMAL');
        } else {
          engine.setStatusInput(cur.slice(0, -1));
        }
        return;
      }
      if (key.length === 1) {
        engine.setStatusInput(engine.getStatusInput() + key);
        return;
      }
    }
    // unknown key: no-op (total input contract)
  }

  // [LSP] TOTAL: always returns a renderable model (MODES.md §Decision C).
  // Format: COMMAND | :buffer | —
  statusline(engine: Engine): StatuslineModel {
    return { mode: 'COMMAND', input: `:${engine.getStatusInput()}` };
  }

  // COMMAND has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
