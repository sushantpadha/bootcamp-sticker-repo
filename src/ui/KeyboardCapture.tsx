import { useEffect, useLayoutEffect, useRef } from 'react';
import type { EngineStore } from '../app/engine/engine';
import type { AppState } from '../app/engine/appState';
import { createClipboardCandidate } from '../app/upload/candidateFactories';
import { isAcceptedUploadMime } from '../app/upload/mimeCoercion';

interface Props {
  engine: EngineStore;
  snapshot: AppState;
}

// Modifier-only keys — pressing these alone should never be treated as actions.
const MODIFIER_KEYS = new Set([
  'Control', 'Alt', 'Shift', 'Meta',
  'CapsLock', 'NumLock', 'ScrollLock',
  'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock',
]);

// Document-level keydown listener. Normalizes DOM events to the KeyEvent
// shape (MODES.md) and routes to the engine. preventDefault is the mode's
// responsibility — KeyboardCapture only handles the NORMAL belt-and-braces
// suppression to prevent browser shortcuts (Ctrl+R etc.) firing before the
// mode handler runs.
export function KeyboardCapture({ engine, snapshot }: Props): null {
  const snapshotRef = useRef(snapshot);
  useLayoutEffect(() => { snapshotRef.current = snapshot; });

  useEffect(() => {
    function onKeyDown(domEvt: KeyboardEvent): void {
      // Skip if focus is inside a DOM input (upload modal queue rows). The
      // input handles its own key events; we don't route through the engine.
      const target = domEvt.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }

      const { modeName } = snapshotRef.current;
      const isModifier = MODIFIER_KEYS.has(domEvt.key);

      // Decision B: NORMAL preventDefault on every non-modifier key so browser
      // shortcuts don't fire. Other modes preventDefault only on Enter/Tab/Esc
      // (those modes call preventDefault themselves in their handleKey).
      if (modeName === 'NORMAL' && !isModifier) {
        domEvt.preventDefault();
      }

      engine.handleKey({
        key: domEvt.key,
        ctrl: domEvt.ctrlKey,
        shift: domEvt.shiftKey,
        alt: domEvt.altKey,
        meta: domEvt.metaKey,
        preventDefault: () => domEvt.preventDefault(),
      });
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [engine]);

  // Paste handler — active only in UPLOAD mode. Routes clipboard images through
  // the engine dispatch system (enqueueCandidates) instead of a component-local listener.
  useEffect(() => {
    function onPaste(e: ClipboardEvent): void {
      if (snapshotRef.current.modeName !== 'UPLOAD') return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items)
        .filter(item => isAcceptedUploadMime(item.type));
      if (items.length === 0) return;
      e.preventDefault();
      const blobs = items
        .map(item => item.getAsFile())
        .filter((b): b is File => b !== null && isAcceptedUploadMime(b.type));
      if (blobs.length === 0) return;
      const startIdx = snapshotRef.current.uploadQueue.length;
      const candidates = blobs.map((blob, i) => createClipboardCandidate(blob, startIdx + i));
      engine.dispatch({ type: 'enqueueCandidates', candidates });
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [engine]);

  return null;
}
