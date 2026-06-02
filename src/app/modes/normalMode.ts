import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import { computeVisibleGrid, computeFocusIndex } from '../engine/appState';

// Time budgets for multi-key sequences (MODES.md §Decision H).
// Both timers live only inside NormalMode — they are NOT part of AppState.
const GG_TIMEOUT_MS = 500;
const DIGIT_TIMEOUT_MS = 1000;

// ── NormalMode ─────────────────────────────────────────────────────────────────
//
// The default mode. Handles grid + pack navigation and sticker action keys.
//
// Internal buffers (all reset in onExit per decision H):
//   gg detector   — two consecutive 'g' keys within GG_TIMEOUT_MS → move to first
//   digit buffer  — digit keys accumulate within DIGIT_TIMEOUT_MS → [n]p
//
// Key bindings summary:
//   h/l/←/→        grid left/right
//   k/j/↑/↓        grid up/down  (cols=1 for M5; M12 wires actual grid-column count)
//   gg              move to first sticker
//   G               move to last  sticker
//   Tab / Ctrl+n    cycle sidebar selection forward
//   Shift+Tab/Ctrl+p cycle sidebar selection backward
//   [n]p            cycle sidebar n steps forward (n from digit buffer)
//   p  (no digit)   open PACKASSIGN mode
//   y               yank focused sticker
//   f               toggle favourite
//   d               open CONFIRM (delete)
//   r               open RENAME mode
//   t               open TAGS mode
//   /               open SEARCH mode
//   :               open COMMAND mode
//   u               open UPLOAD mode
//   ?               open HELP mode
export class NormalMode implements Mode {
  readonly name = 'NORMAL' as const;

  // ── Internal buffers (not in AppState — decision H) ─────────────────────────

  private awaitingSecondG = false;
  private ggTimer: ReturnType<typeof setTimeout> | null = null;

  private digitBuffer = '';
  private digitTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  // [LSP] idempotent; NORMAL has nothing to prefill (MODES.md enter/exit table)
  onEnter(_engine: Engine): void {}

  // [LSP] clears all mode-internal buffers so no successor inherits stale state
  onExit(_engine: Engine): void {
    this.clearGgBuffer();
    this.clearDigitBuffer();
  }

  // ── handleKey ────────────────────────────────────────────────────────────────

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  // Decision B: NORMAL calls evt.preventDefault() on every non-modifier key so
  // browser shortcuts (save, find, …) are suppressed while in this mode.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, shift, alt, meta } = evt;

    // Pure modifier key-up events carry no intent; pass through silently.
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;

    // Suppress browser shortcuts in NORMAL (decision B).
    evt.preventDefault();

    // ── Digit accumulator ([n]p, decision H) ────────────────────────────────
    // Digits with no modifier key feed the [n] buffer. Leading '0' is ignored
    // unless a non-zero digit has already started the accumulation.
    if (!ctrl && !alt && !meta && !shift && /^[0-9]$/.test(key)) {
      if (key === '0' && this.digitBuffer === '') return; // standalone 0 is a no-op
      this.appendDigit(key);
      return;
    }

    // ── gg two-key sequence (decision H, GG_TIMEOUT_MS window) ─────────────
    if (!ctrl && !alt && !meta && !shift && key === 'g') {
      if (this.awaitingSecondG) {
        this.clearGgBuffer();
        engine.dispatch({ type: 'moveFocusDir', dir: 'first', cols: 1 });
      } else {
        this.awaitingSecondG = true;
        this.ggTimer = setTimeout(
          () => { this.awaitingSecondG = false; this.ggTimer = null; },
          GG_TIMEOUT_MS,
        );
      }
      return;
    }

    // Any key other than 'g' kills the gg sequence.
    this.clearGgBuffer();

    // ── Bare key bindings (no ctrl / alt / meta) ────────────────────────────
    if (!ctrl && !alt && !meta) {
      switch (key) {

        // Grid navigation
        // cols=1: correct for sequential traversal at M5. M12 (KeyboardCapture)
        // will pass the actual rendered grid-column count for true 2-D up/down.
        case 'h': case 'ArrowLeft':
          engine.dispatch({ type: 'moveFocusDir', dir: 'left',  cols: 1 });
          return;
        case 'l': case 'ArrowRight':
          engine.dispatch({ type: 'moveFocusDir', dir: 'right', cols: 1 });
          return;
        case 'k': case 'ArrowUp':
          engine.dispatch({ type: 'moveFocusDir', dir: 'up',    cols: 1 });
          return;
        case 'j': case 'ArrowDown':
          engine.dispatch({ type: 'moveFocusDir', dir: 'down',  cols: 1 });
          return;
        case 'G':
          engine.dispatch({ type: 'moveFocusDir', dir: 'last',  cols: 1 });
          return;

        // [n]p — cycle sidebar n steps forward; bare p opens PACKASSIGN
        case 'p': {
          const n = this.flushDigitBuffer();
          if (n > 0) {
            for (let i = 0; i < n; i++) engine.dispatch({ type: 'cycleSelection', delta: 1 });
          } else {
            engine.transitionTo('PACKASSIGN');
          }
          return;
        }

        // Tab: cycle sidebar forward or backward (shift+Tab)
        case 'Tab':
          engine.dispatch({ type: 'cycleSelection', delta: shift ? -1 : 1 });
          return;

        // Mode transitions
        case '/': engine.transitionTo('SEARCH');  return;
        case ':': engine.transitionTo('COMMAND'); return;
        case 'u': engine.transitionTo('UPLOAD');  return;
        case '?': engine.transitionTo('HELP');    return;
        case 'r': engine.transitionTo('RENAME');  return;
        case 't': engine.transitionTo('TAGS');    return;
        case 'd': engine.transitionTo('CONFIRM'); return;

        // Sticker actions → intents
        case 'y': engine.dispatch({ type: 'yankFocused' });     return;
        case 'f': engine.dispatch({ type: 'toggleFavourite' }); return;

        default: return; // unknown key: no-op (total input contract)
      }
    }

    // ── Ctrl bindings ────────────────────────────────────────────────────────
    if (ctrl && !alt && !meta) {
      switch (key) {
        case 'n': engine.dispatch({ type: 'cycleSelection', delta:  1 }); return;
        case 'p': engine.dispatch({ type: 'cycleSelection', delta: -1 }); return;
        default:  return;
      }
    }

    // Unknown modifier combination: no-op (total input contract satisfied)
  }

  // ── statusline ───────────────────────────────────────────────────────────────

  // [LSP] TOTAL: always returns a valid model (MODES.md §Decision C).
  // Format: NORMAL | — | <sort.id> · <selection.label()> · [focusIdx+1/total]
  statusline(engine: Engine): StatuslineModel {
    const state = engine.getSnapshot();
    const grid  = computeVisibleGrid(state);
    const idx   = computeFocusIndex(state.focusId, grid);
    const pos   = idx >= 0 ? idx + 1 : 0;
    const right = `${state.sort.id} · ${state.selection.label()} · [${pos}/${grid.length}]`;
    return { mode: 'NORMAL', right };
  }

  // NORMAL has no overlay.
  overlay(_engine: Engine): OverlayModel | null {
    return null;
  }

  // ── Internal buffer helpers ───────────────────────────────────────────────────

  private appendDigit(d: string): void {
    this.digitBuffer += d;
    if (this.digitTimer !== null) clearTimeout(this.digitTimer);
    this.digitTimer = setTimeout(
      () => { this.digitBuffer = ''; this.digitTimer = null; },
      DIGIT_TIMEOUT_MS,
    );
  }

  private flushDigitBuffer(): number {
    if (this.digitTimer !== null) { clearTimeout(this.digitTimer); this.digitTimer = null; }
    const n = this.digitBuffer.length > 0 ? parseInt(this.digitBuffer, 10) : 0;
    this.digitBuffer = '';
    return n;
  }

  private clearGgBuffer(): void {
    if (this.ggTimer !== null) { clearTimeout(this.ggTimer); this.ggTimer = null; }
    this.awaitingSecondG = false;
  }

  private clearDigitBuffer(): void {
    if (this.digitTimer !== null) { clearTimeout(this.digitTimer); this.digitTimer = null; }
    this.digitBuffer = '';
  }
}
