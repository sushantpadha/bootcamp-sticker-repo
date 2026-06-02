import type { AppState, } from '../app/engine/appState';
import { computeVisibleGrid } from '../app/engine/appState';
import type { Intent } from '../app/engine/intents';
import { StickerCell } from './StickerCell';

interface Props {
  snapshot: AppState;
  objectURLs: ReadonlyMap<string, string>;
  dispatch: (intent: Intent) => void;
}

export function Grid({ snapshot, objectURLs, dispatch }: Props) {
  const grid = computeVisibleGrid(snapshot);

  if (grid.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-dim)',
        }}
      >
        No stickers
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 96px)',
        gap: 1,
        padding: 8,
        alignContent: 'start',
      }}
    >
      {grid.map(sticker => (
        <StickerCell
          key={sticker.id}
          sticker={sticker}
          isFocused={sticker.id === snapshot.focusId}
          objectURL={objectURLs.get(sticker.id) ?? ''}
          onClick={() => dispatch({ type: 'moveFocus', id: sticker.id })}
        />
      ))}
    </div>
  );
}
