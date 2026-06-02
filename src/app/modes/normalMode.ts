import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import type { Timer, TimerHandle } from '../ports/timer';
import { computeVisibleGrid, computeFocusIndex } from '../engine/appState';

// MODES.md decision H — time-bounded mode-internal buffers.
const GG_TIMEOUT_MS = 500;
const DIGIT_TIMEOUT_MS = 1000;
const YY_TIMEOUT_MS = 500;

// ── NormalMode ─────────────────────────────────────────────────────────────────
// Default mode. Implements every NORMAL keybinding from MODES.md table.
//
// Internal buffers (all reset in onExit, Timer-driven not setTimeout):
//   gg detector   — two consecutive 'g' keys within GG_TIMEOUT_MS → first
//   yy detector   — two consecutive 'y' keys within YY_TIMEOUT_MS → yank
//   digit buffer  — digit keys accumulate within DIGIT_TIMEOUT_MS → [n]p
export class NormalMode implements Mode {
  readonly name = 'NORMAL' as const;
  private readonly timer: Timer;

  // Internal buffers
  private awaitingSecondG = false;
  private ggHandle: TimerHandle | null = null;
  private awaitingSecondY = false;
  private yyHandle: TimerHandle | null = null;
  private digitBuffer = '';
  private digitHandle: TimerHandle | null = null;

  constructor(timer: Timer) {
    this.timer = timer;
  }

  onEnter(_engine: Engine): void {}

  onExit(_engine: Engine): void {
    this.clearGg();
    this.clearYy();
    this.clearDigits();
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, shift, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;

    // Decision B: NORMAL preventDefault on every non-modifier key.
    evt.preventDefault();

    const state = engine.getSnapshot();
    const cols = state.gridCols;
    const hasFocus = state.focusId !== null;

    // ── Digit accumulator ([n]p) ─────────────────────────────────────────────
    // Digits with no modifier feed the buffer. Standalone `0` (no prior digit)
    // is the row-start jump, NOT a digit.
    if (!ctrl && !alt && !meta && !shift && /^[0-9]$/.test(key)) {
      if (key === '0' && this.digitBuffer === '') {
        engine.dispatch({ type: 'moveFocusDir', dir: 'rowStart', cols });
        return;
      }
      this.appendDigit(key);
      return;
    }

    // ── gg two-key sequence ────────────────────────────────────────────────
    if (!ctrl && !alt && !meta && !shift && key === 'g') {
      if (this.awaitingSecondG) {
        this.clearGg();
        engine.dispatch({ type: 'moveFocusDir', dir: 'first', cols });
      } else {
        this.awaitingSecondG = true;
        this.ggHandle = this.timer.setTimeout(() => {
          this.awaitingSecondG = false;
          this.ggHandle = null;
        }, GG_TIMEOUT_MS);
      }
      return;
    }
    this.clearGg();

    // ── yy two-key sequence ────────────────────────────────────────────────
    if (!ctrl && !alt && !meta && !shift && key === 'y') {
      if (!hasFocus) return; // empty-grid silent no-op
      if (this.awaitingSecondY) {
        this.clearYy();
        engine.dispatch({ type: 'yankFocused' });
      } else {
        this.awaitingSecondY = true;
        this.yyHandle = this.timer.setTimeout(() => {
          this.awaitingSecondY = false;
          this.yyHandle = null;
        }, YY_TIMEOUT_MS);
      }
      return;
    }
    this.clearYy();

    // ── Ctrl bindings ────────────────────────────────────────────────────────
    if (ctrl && !alt && !meta) {
      switch (key) {
        case 'n': case 'N':
          engine.dispatch({ type: 'cycleSelection', delta:  1 }); return;
        case 'p': case 'P':
          engine.dispatch({ type: 'cycleSelection', delta: -1 }); return;
        case 't': case 'T':
          engine.dispatch({ type: 'setTheme', theme: state.theme === 'dark' ? 'light' : 'dark' });
          engine.setFlash(`theme: ${state.theme === 'dark' ? 'light' : 'dark'}`, false);
          return;
        default: return;
      }
    }

    // ── Bare-key bindings (no ctrl/alt/meta) ─────────────────────────────────
    if (!ctrl && !alt && !meta) {
      // Pack [n]p flush — must happen BEFORE the bare-`p` switch below.
      if (key === 'p' && this.digitBuffer.length > 0 && !shift) {
        const n = this.flushDigits();
        engine.dispatch({ type: 'jumpToPack', index: n });
        return;
      }

      switch (key) {
        // Grid navigation
        case 'h': case 'ArrowLeft':
          engine.dispatch({ type: 'moveFocusDir', dir: 'left', cols }); return;
        case 'l': case 'ArrowRight':
          engine.dispatch({ type: 'moveFocusDir', dir: 'right', cols }); return;
        case 'k': case 'ArrowUp':
          engine.dispatch({ type: 'moveFocusDir', dir: 'up', cols }); return;
        case 'j': case 'ArrowDown':
          engine.dispatch({ type: 'moveFocusDir', dir: 'down', cols }); return;
        case 'G':
          engine.dispatch({ type: 'moveFocusDir', dir: 'last', cols }); return;
        case '$':
          engine.dispatch({ type: 'moveFocusDir', dir: 'rowEnd', cols }); return;

        // Pack cycling
        case 'p':
          engine.dispatch({ type: 'cycleSelection', delta:  1 }); return;
        case 'P':
          engine.dispatch({ type: 'cycleSelection', delta: -1 }); return;
        case 'Tab':
          engine.dispatch({ type: 'cycleSelection', delta: shift ? -1 : 1 }); return;

        // Search nav
        case 'n':
          engine.dispatch({ type: 'searchNext' }); return;
        case 'N':
          engine.dispatch({ type: 'searchPrev' }); return;

        // Yank (Enter = yy single keystroke)
        case 'Enter':
          if (!hasFocus) return;
          engine.dispatch({ type: 'yankFocused' });
          return;

        // Action keys (empty-grid silent no-op per SPEC)
        case 'f':
          if (!hasFocus) return;
          engine.dispatch({ type: 'toggleFavourite' });
          return;
        case 'd':
          if (!hasFocus) return;
          engine.transitionTo('CONFIRM');
          return;
        case 'r':
          if (!hasFocus) return;
          engine.transitionTo('RENAME');
          return;
        case 't':
          if (!hasFocus) return;
          engine.transitionTo('TAGS');
          return;
        case 'm':
          if (!hasFocus) return;
          engine.transitionTo('PACKASSIGN');
          return;

        // Mode transitions (no focus requirement)
        case '/': engine.transitionTo('SEARCH');  return;
        case ':': engine.transitionTo('COMMAND'); return;
        case 'a': engine.transitionTo('UPLOAD');  return;
        case '?': engine.transitionTo('HELP');    return;

        default: return;
      }
    }
  }

  statusline(engine: Engine): StatuslineModel {
    const state = engine.getSnapshot();
    const grid  = computeVisibleGrid(state);
    const idx   = computeFocusIndex(state.focusId, grid);
    const pos   = idx >= 0 ? idx + 1 : 0;
    const right = `${state.sort.id} · ${state.selection.label()} · [${pos}/${grid.length}]`;
    return { mode: 'NORMAL', right };
  }

  overlay(_engine: Engine): OverlayModel | null { return null; }

  // ── Internal buffer helpers ───────────────────────────────────────────────
  private appendDigit(d: string): void {
    this.digitBuffer += d;
    if (this.digitHandle !== null) this.timer.clearTimeout(this.digitHandle);
    this.digitHandle = this.timer.setTimeout(() => {
      this.digitBuffer = '';
      this.digitHandle = null;
    }, DIGIT_TIMEOUT_MS);
  }
  private flushDigits(): number {
    if (this.digitHandle !== null) { this.timer.clearTimeout(this.digitHandle); this.digitHandle = null; }
    const n = this.digitBuffer.length > 0 ? parseInt(this.digitBuffer, 10) : 0;
    this.digitBuffer = '';
    return n;
  }
  private clearGg(): void {
    if (this.ggHandle !== null) { this.timer.clearTimeout(this.ggHandle); this.ggHandle = null; }
    this.awaitingSecondG = false;
  }
  private clearYy(): void {
    if (this.yyHandle !== null) { this.timer.clearTimeout(this.yyHandle); this.yyHandle = null; }
    this.awaitingSecondY = false;
  }
  private clearDigits(): void {
    if (this.digitHandle !== null) { this.timer.clearTimeout(this.digitHandle); this.digitHandle = null; }
    this.digitBuffer = '';
  }
}
