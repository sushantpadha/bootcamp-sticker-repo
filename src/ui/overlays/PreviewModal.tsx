import type { CSSProperties } from 'react';
import type { AppState } from '../../app/engine/appState';
import type { Intent } from '../../app/engine/intents';
import { MODAL_BACKDROP_STYLE } from '../theme/styles';

interface Props {
  snapshot: AppState;
  objectURLs: ReadonlyMap<string, string>;
  dispatch: (intent: Intent) => void;
}

// Overlay covers the grid panel only (position: absolute inside position: relative
// grid panel container — sidebar and statusline remain visible).
const BACKDROP_STYLE: CSSProperties = {
  ...MODAL_BACKDROP_STYLE,
  flexDirection: 'column',
  zIndex: 500,
};

const IMAGE_STYLE: CSSProperties = {
  maxWidth: 512,
  maxHeight: 512,
  objectFit: 'contain',
  display: 'block',
  border: '1px solid var(--border)',
};

const META_STYLE: CSSProperties = {
  marginTop: 20,
  textAlign: 'center',
  color: 'var(--text)',
  maxWidth: 512,
};

const NAME_STYLE: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginBottom: 8,
};

const DETAIL_STYLE: CSSProperties = {
  fontSize: 14,
  color: 'var(--text-dim)',
  marginBottom: 4,
};

const HINT_STYLE: CSSProperties = {
  marginTop: 20,
  fontSize: 14,
  color: 'var(--text-dim)',
};

export function PreviewModal({ snapshot, objectURLs, dispatch }: Props) {
  const sticker = snapshot.stickers.find(s => s.id === snapshot.focusId);
  if (!sticker) return null;

  const objectURL = objectURLs.get(sticker.id) ?? '';
  const packNames = sticker.packIds
    .map(id => snapshot.packs.find(p => p.id === id)?.name)
    .filter((n): n is string => n !== undefined);

  const close = () => dispatch({ type: 'setPreviewOpen', open: false });

  return (
    <div style={BACKDROP_STYLE} onClick={close}>
      <div onClick={e => e.stopPropagation()}>
        <img src={objectURL} alt={sticker.name} style={IMAGE_STYLE} />
        <div style={META_STYLE}>
          <div style={NAME_STYLE}>{sticker.name}</div>
          {sticker.tags.length > 0 && (
            <div style={DETAIL_STYLE}>tags: {sticker.tags.join(', ')}</div>
          )}
          {packNames.length > 0 && (
            <div style={DETAIL_STYLE}>packs: {packNames.join(', ')}</div>
          )}
        </div>
        <div style={HINT_STYLE}>esc / space to close</div>
      </div>
    </div>
  );
}
