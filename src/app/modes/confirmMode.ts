import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// CONFIRM — currently only used for delete-focused. NormalMode's `d` guard
// ensures `state.focusId !== null` before transitioning here, so the
// no-focus branch is unreachable (MODES.md per-mode table).
interface PendingDelete { stickerName: string; }

export class ConfirmMode implements Mode {
  readonly name = 'CONFIRM' as const;
  private pending: PendingDelete | null = null;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    this.pending = focused ? { stickerName: focused.name } : null;
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'y' || key === 'Y') {
      if (this.pending !== null) engine.dispatch({ type: 'deleteFocused' });
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'n' || key === 'N' || key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }
  }

  statusline(_engine: Engine): StatuslineModel {
    const right = this.pending !== null
      ? `delete "${this.pending.stickerName}"? [y/n]`
      : '[y/n]';
    return { mode: 'CONFIRM', right };
  }
  overlay(_engine: Engine): OverlayModel | null { return null; }
  onExit(_engine: Engine): void { this.pending = null; }
}
