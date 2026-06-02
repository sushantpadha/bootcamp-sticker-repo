import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

export class HelpMode implements Mode {
  readonly name = 'HELP' as const;

  onEnter(_engine: Engine): void {}

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape' || key === 'q' || key === 'Q') {
      evt.preventDefault();
    }
    if (key === 'q' || key === 'Q' || key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }
  }

  statusline(_engine: Engine): StatuslineModel {
    return { mode: 'HELP', right: 'q/Esc to close' };
  }
  overlay(_engine: Engine): OverlayModel { return { type: 'HELP' }; }
  onExit(_engine: Engine): void {}
}
