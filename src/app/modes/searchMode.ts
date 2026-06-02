import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import { computeVisibleGrid } from '../engine/appState';

// ── SearchMode ─────────────────────────────────────────────────────────────────
//
// Live search: every keystroke updates AppState.search via setSearch intent.
//
// enter/exit table (MODES.md):
//   onEnter  — statusInput ← current state.search
//   onExit   — statusInput cleared; Esc reverts search to pre-enter value
//
// Key bindings:
//   printable char   — append to buffer, dispatch setSearch
//   Backspace        — delete last char, dispatch setSearch
//   Enter            — accept current search, transition to NORMAL
//   Escape           — revert search to pre-enter value, transition to NORMAL
export class SearchMode implements Mode {
  readonly name = 'SEARCH' as const;

  // The search string that was active when we entered SEARCH mode.
  // Stored so Esc can revert to it (NORMAL mode picks up state.search).
  private searchOnEnter = '';

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    this.searchOnEnter = state.search;
    engine.setStatusInput(state.search);
  }

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    evt.preventDefault();

    if (key === 'Escape') {
      engine.dispatch({ type: 'setSearch', query: this.searchOnEnter });
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'Enter') {
      engine.transitionTo('NORMAL');
      return;
    }
    if (!ctrl && !alt && !meta) {
      if (key === 'Backspace') {
        const next = engine.getStatusInput().slice(0, -1);
        engine.setStatusInput(next);
        engine.dispatch({ type: 'setSearch', query: next });
        return;
      }
      if (key.length === 1) {
        const next = engine.getStatusInput() + key;
        engine.setStatusInput(next);
        engine.dispatch({ type: 'setSearch', query: next });
        return;
      }
    }
    // unknown key: no-op (total input contract)
  }

  // [LSP] TOTAL: always returns a renderable model (MODES.md §Decision C).
  // Format: SEARCH | /query | <matchCount> matches
  statusline(engine: Engine): StatuslineModel {
    const state = engine.getSnapshot();
    const grid = computeVisibleGrid(state);
    return {
      mode: 'SEARCH',
      input: `/${state.statusInput}`,
      right: `${grid.length} matches`,
    };
  }

  // SEARCH has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
