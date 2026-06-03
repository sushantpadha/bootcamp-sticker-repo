import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AppState } from '../app/engine/appState';
import { computeVisibleGrid } from '../app/engine/appState';
import type { Intent } from '../app/engine/intents';
import { StickerCell } from './StickerCell';
import { GRID_STYLE, EMPTY_CENTERED_STYLE } from './theme/styles';

interface Props {
  snapshot: AppState;
  objectURLs: ReadonlyMap<string, string>;
  dispatch: (intent: Intent) => void;
}

export function Grid({ snapshot, objectURLs, dispatch }: Props) {
  const grid = computeVisibleGrid(snapshot);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellZoom = snapshot.cellZoom;

  // Publish actual visible column count to engine on resize or zoom change.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const publish = () => {
      const cols = Math.max(1, Math.floor(el.clientWidth / (cellZoom + 1))); // +1 for grid gap
      dispatch({ type: 'setGridCols', cols });
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dispatch, cellZoom]);

  const gridStyle: CSSProperties = {
    ...GRID_STYLE,
    gridTemplateColumns: `repeat(auto-fill, ${cellZoom}px)`,
  };

  // ── Empty states ──────────────────────────────────────────────────
  // 1. DB-empty: show SPEC hint "press a to add your first sticker"
  // 2. Filtered-empty: show "(no stickers)"
  if (snapshot.stickers.length === 0) {
    return (
      <div ref={containerRef} style={EMPTY_CENTERED_STYLE}>
        press a to add your first sticker
      </div>
    );
  }
  if (grid.length === 0) {
    return (
      <div ref={containerRef} style={EMPTY_CENTERED_STYLE}>
        (no stickers)
      </div>
    );
  }

  return (
    <div ref={containerRef} style={gridStyle}>
      {grid.map(sticker => (
        <StickerCell
          key={sticker.id}
          sticker={sticker}
          isFocused={sticker.id === snapshot.focusId}
          objectURL={objectURLs.get(sticker.id) ?? ''}
          packs={snapshot.packs}
          cellSize={cellZoom}
          onClick={() => dispatch({ type: 'moveFocus', id: sticker.id })}
        />
      ))}
    </div>
  );
}
