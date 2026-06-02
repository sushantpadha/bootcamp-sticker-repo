import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── PackAssignMode ─────────────────────────────────────────────────────────────
//
// Edit the pack assignments of the focused sticker as a comma-separated list of
// pack names. Tab-completion of the current token is wired in M7 (command registry).
//
// enter/exit table (MODES.md):
//   onEnter  — statusInput ← focused sticker's resolved pack names joined with ", "
//   onExit   — statusInput cleared
//
// Key bindings:
//   printable char   — append to buffer
//   Backspace        — delete last char
//   Enter            — parse buffer as pack names, dispatch assignPacks, go to NORMAL
//   Escape           — discard, go to NORMAL
//   Tab              — (tab-completion stub; wired in M7)
export class PackAssignMode implements Mode {
  readonly name = 'PACKASSIGN' as const;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    if (focused !== undefined) {
      const packNames = focused.packIds
        .map(id => state.packs.find(p => p.id === id)?.name)
        .filter((n): n is string => n !== undefined);
      engine.setStatusInput(packNames.join(', '));
    } else {
      engine.setStatusInput('');
    }
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
      const packNames = engine.getStatusInput()
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0);
      engine.dispatch({ type: 'assignPacks', packNames });
      engine.transitionTo('NORMAL');
      return;
    }
    if (!ctrl && !alt && !meta) {
      if (key === 'Backspace') {
        engine.setStatusInput(engine.getStatusInput().slice(0, -1));
        return;
      }
      if (key === 'Tab') {
        // Tab-completion of the current token is wired in M7.
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
  statusline(engine: Engine): StatuslineModel {
    return { mode: 'PACKASSIGN', input: engine.getStatusInput() };
  }

  // PACKASSIGN has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
