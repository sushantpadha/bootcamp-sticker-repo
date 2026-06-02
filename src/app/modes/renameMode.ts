import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── RenameMode ─────────────────────────────────────────────────────────────────
//
// Inline rename of the focused sticker.
//
// enter/exit table (MODES.md):
//   onEnter  — statusInput ← focused sticker's current name
//   onExit   — statusInput cleared
//
// Key bindings:
//   printable char   — append to buffer
//   Backspace        — delete last char
//   Enter            — dispatch renameFocused if buffer non-empty, go to NORMAL
//   Escape           — discard, go to NORMAL
export class RenameMode implements Mode {
  readonly name = 'RENAME' as const;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    engine.setStatusInput(focused?.name ?? '');
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
      const name = engine.getStatusInput().trim();
      if (name.length > 0) {
        engine.dispatch({ type: 'renameFocused', name });
      }
      engine.transitionTo('NORMAL');
      return;
    }
    if (!ctrl && !alt && !meta) {
      if (key === 'Backspace') {
        engine.setStatusInput(engine.getStatusInput().slice(0, -1));
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
    return { mode: 'RENAME', input: engine.getStatusInput() };
  }

  // RENAME has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
