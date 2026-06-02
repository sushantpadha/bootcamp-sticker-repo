import { useEffect, useRef } from 'react';
import type { EngineStore } from '../app/engine/engine';
import type { AppState } from '../app/engine/appState';

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

// Renders nothing; installs a document-level keydown listener.
// Normalizes DOM events to the KeyEvent contract (MODES.md) and routes them
// to engine.handleKey.  In NORMAL mode every non-modifier key gets
// preventDefault() before routing so browser shortcuts don't fire.
export function KeyboardCapture({ engine, snapshot }: Props): null {
  // Keep a ref to the latest snapshot so the single event listener always
  // reads the current mode without being re-registered on every render.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    function onKeyDown(domEvt: KeyboardEvent): void {
      const { modeName } = snapshotRef.current;
      const isModifier = MODIFIER_KEYS.has(domEvt.key);

      // MODES.md Decision B: in NORMAL mode, prevent every non-modifier key
      // so no browser shortcut fires.
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

  return null;
}
