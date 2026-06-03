import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

export class TagsMode implements Mode {
  readonly name = 'TAGS' as const;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    engine.setStatusInput(focused?.tags.join(', ') ?? '');
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'Escape') { engine.transitionTo('NORMAL'); return; }
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
  }

  statusline(engine: Engine): StatuslineModel {
    return { mode: 'TAGS', input: engine.getStatusInput() };
  }
  overlay(_engine: Engine): OverlayModel | null { return null; }
  onExit(engine: Engine): void { engine.setStatusInput(''); }
}
