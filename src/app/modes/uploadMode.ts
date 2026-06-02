import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';

// ── UploadMode ─────────────────────────────────────────────────────────────────
//
// EXCLUSIVE mode (MODES.md §Decision B): UPLOAD is not an overlay bolted onto
// NORMAL. It is its own active mode. The modal UI is the `overlay()` output only
// (rendered by M15: UploadModal). While UPLOAD is active, NORMAL keybindings are
// completely inert — only UploadMode.handleKey sees events.
//
// enter/exit table (MODES.md):
//   onEnter  — ensures uploadQueue is initialized (may be empty; no-op if already set)
//   onExit   — clears uploadQueue; thumbnail object URL revocation is the UI
//              layer's responsibility (UploadModal, M15) per the import boundary rule
//
// Key bindings:
//   Enter    — dispatch saveUpload, transition to NORMAL
//   Escape   — discard queue (onExit clears it), transition to NORMAL
//   (all other input is handled by DOM inputs inside the overlay UI)
export class UploadMode implements Mode {
  readonly name = 'UPLOAD' as const;

  // [LSP] Idempotent — uploadQueue may already have items from a prior Ctrl+V paste;
  // we leave it alone.
  onEnter(_engine: Engine): void {}

  // [LSP] TOTAL: accepts any KeyEvent; unknown keys are silent no-ops.
  // Modal DOM inputs handle their own keyboard events; only Escape/Enter reach here.
  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    evt.preventDefault();

    if (key === 'Escape') {
      // onExit will clear the queue.
      engine.transitionTo('NORMAL');
      return;
    }
    if (key === 'Enter') {
      engine.dispatch({ type: 'saveUpload' });
      engine.transitionTo('NORMAL');
      return;
    }
    // unknown key: no-op (total input contract)
  }

  // [LSP] TOTAL: always returns a renderable model (MODES.md §Decision C).
  // Format: UPLOAD | — | <queueLength> queued
  statusline(engine: Engine): StatuslineModel {
    const { uploadQueue } = engine.getSnapshot();
    return { mode: 'UPLOAD', right: `${uploadQueue.length} queued` };
  }

  // UPLOAD is an exclusive mode; its modal content comes from overlay() only.
  overlay(_engine: Engine): OverlayModel {
    return { type: 'UPLOAD' };
  }

  // [LSP] Clears the upload queue so no successor mode inherits stale entries.
  // Thumbnail object URL revocation is handled by the UI overlay (M15) because
  // URL.revokeObjectURL is a browser global that must not be called from app/**.
  onExit(engine: Engine): void {
    const { uploadQueue } = engine.getSnapshot();
    for (let i = uploadQueue.length - 1; i >= 0; i--) {
      engine.dispatch({ type: 'removeQueueRow', index: i });
    }
  }
}
