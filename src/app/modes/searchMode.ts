import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import { computeVisibleGrid } from '../engine/appState';

// SearchMode — live search input in the statusline.
// MODES.md per-mode table:
//   onEnter  — statusInput ← current state.search
//   onExit   — statusInput cleared (state.search persists)
// Esc: clears state.search to "" (SPEC-literal) and returns to NORMAL.
// Enter: leaves state.search as-is (the live filter committed by keystrokes).
//
// NO mode-internal state (per MODES.md decision H/I — only NormalMode is
// sanctioned to hold gg/digit buffers).
export class SearchMode implements Mode {
  readonly name = 'SEARCH' as const;

  onEnter(engine: Engine): void {
    engine.setStatusInput(engine.getSnapshot().search);
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;

    // Per MODES.md decision B: only NORMAL preventDefaults all keys. Input modes
    // preventDefault on Enter/Tab/Escape only.
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'Escape') {
      engine.dispatch({ type: 'setSearch', query: '' });
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
  }

  statusline(engine: Engine): StatuslineModel {
    const state = engine.getSnapshot();
    const grid = computeVisibleGrid(state);
    return {
      mode: 'SEARCH',
      input: `/${state.statusInput}`,
      right: `${grid.length} matches`,
    };
  }

  overlay(_engine: Engine): OverlayModel | null { return null; }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
