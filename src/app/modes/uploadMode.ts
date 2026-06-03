import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

export class UploadMode implements Mode {
  readonly name = 'UPLOAD' as const;

  onEnter(_engine: Engine): void {}

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'Escape') {
      // onExit clears the queue.
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'Enter') {
      engine.dispatch({ type: 'saveUpload' });
      engine.transitionTo('NORMAL');
      return;
    }
  }

  statusline(engine: Engine): StatuslineModel {
    const { uploadQueue } = engine.getSnapshot();
    return { mode: 'UPLOAD', right: `${uploadQueue.length} queued` };
  }

  overlay(_engine: Engine): OverlayModel { return { type: 'UPLOAD' }; }

  // Clear the queue by removing rows in reverse so indices stay valid during removal.
  onExit(engine: Engine): void {
    const len = engine.getSnapshot().uploadQueue.length;
    for (let i = len - 1; i >= 0; i--) {
      engine.dispatch({ type: 'removeQueueRow', index: i });
    }
  }
}
