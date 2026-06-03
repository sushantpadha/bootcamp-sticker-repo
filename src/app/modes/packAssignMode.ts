import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import { completeToken } from '../../domain/naming/completeToken';

export class PackAssignMode implements Mode {
  readonly name = 'PACKASSIGN' as const;

  onEnter(engine: Engine): void {
    const state = engine.getSnapshot();
    const focused = state.stickers.find(s => s.id === state.focusId);
    if (!focused) {
      engine.setStatusInput('');
      return;
    }
    const packNames = focused.packIds
      .map(id => state.packs.find(p => p.id === id)?.name)
      .filter((n): n is string => n !== undefined);
    engine.setStatusInput(packNames.join(', '));
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'Escape') { engine.transitionTo('NORMAL'); return; }
    if (key === 'Enter') {
      const packNames = engine.getStatusInput()
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0);
      engine.dispatch({ type: 'assignPacks', packNames });
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'Tab') {
      const candidates = engine.getSnapshot().packs.map(p => p.name);
      engine.setStatusInput(completeToken(engine.getStatusInput(), candidates));
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
    return { mode: 'PACKASSIGN', input: engine.getStatusInput() };
  }
  overlay(_engine: Engine): OverlayModel | null { return null; }
  onExit(engine: Engine): void { engine.setStatusInput(''); }
}
