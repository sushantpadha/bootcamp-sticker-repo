import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── TagsMode ───────────────────────────────────────────────────────────────────
//
// Edit the tags of the focused sticker as a comma-separated string.
//
// enter/exit table (MODES.md):
//   onEnter  — statusInput ← focused sticker's tags joined with ", "
//   onExit   — statusInput cleared
//
// Key bindings:
//   printable char   — append to buffer
//   Backspace        — delete last char
//   Enter            — parse buffer as ", "-separated tags, dispatch setTags, go to NORMAL
//   Escape           — discard, go to NORMAL
export class TagsMode implements Mode {
  readonly name = 'TAGS' as const;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    engine.setStatusInput(focused?.tags.join(', ') ?? '');
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
      const tags = engine.getStatusInput()
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      engine.dispatch({ type: 'setTags', tags });
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
    return { mode: 'TAGS', input: engine.getStatusInput() };
  }

  // TAGS has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
