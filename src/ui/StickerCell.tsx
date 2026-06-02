import { memo, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';

interface Props {
  sticker: Sticker;
  isFocused: boolean;
  objectURL: string;
  onClick: () => void;
}

export const StickerCell = memo(function StickerCell({ sticker, isFocused, objectURL, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  const bg = isFocused
    ? 'var(--bg-cell-focus)'
    : hovered
    ? 'var(--bg-cell-hover)'
    : 'var(--bg-cell)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 96,
        cursor: 'pointer',
        background: bg,
        border: `1px solid ${isFocused ? 'var(--border-focus)' : 'var(--border)'}`,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <img
        src={objectURL}
        alt={sticker.name}
        style={{ width: 96, height: 96, objectFit: 'contain', display: 'block' }}
      />
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 11,
          color: 'var(--text-dim)',
          padding: '2px 4px',
        }}
      >
        {sticker.name}
      </div>
    </div>
  );
});
