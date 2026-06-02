import { useSyncExternalStore } from 'react';
import type { EngineStore } from '../app/engine/engine';
import type { Intent } from '../app/engine/intents';
import type { AppState } from '../app/engine/appState';

export interface EngineBinding {
  snapshot: AppState;
  dispatch: (intent: Intent) => void;
}

// Decision A (STATE.md): React reads the engine through useSyncExternalStore.
// The engine has zero React imports; this hook is the sole bridge.
export function useEngine(store: EngineStore): EngineBinding {
  const snapshot = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store),
  );
  return { snapshot, dispatch: store.dispatch.bind(store) };
}
