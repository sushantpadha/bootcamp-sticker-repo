import { memo, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';
import type { Pack } from '../domain/entities/pack';
import {
  CELL_STYLE, CELL_FOCUSED_STYLE, CELL_HOVER_STYLE, CELL_IMAGE_STYLE,
  CELL_NAME_STYLE, TOOLTIP_STYLE, truncate,
} from './theme/styles';

interface Props {
  sticker: Sticker;
  isFocused: boolean;
  objectURL: string;
  packs: Pack[];
  cellSize: number;
  onClick: () => void;
}

function buildTooltip(sticker: Sticker, packs: Pack[]): string {
  const lines = [sticker.name];
  if (sticker.tags.length > 0) lines.push(`tags: ${sticker.tags.join(', ')}`);
  const packNames = sticker.packIds
    .map(id => packs.find(p => p.id === id)?.name)
    .filter((n): n is string => n !== undefined);
  if (packNames.length > 0) lines.push(`packs: ${packNames.join(', ')}`);
  return lines.join('\n');
}

export const StickerCell = memo(function StickerCell({
  sticker, isFocused, objectURL, packs, cellSize, onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const tooltip = buildTooltip(sticker, packs);

  const style = {
    ...CELL_STYLE,
    width: cellSize,
    ...(isFocused ? CELL_FOCUSED_STYLE : {}),
    ...(hovered ? CELL_HOVER_STYLE : {}),
  };

  const imageStyle = {
    ...CELL_IMAGE_STYLE,
    width: cellSize,
    height: cellSize,
  };

  const nameFontSize = Math.max(10, Math.floor(cellSize / 10));
  const nameMaxChars = Math.max(6, Math.round(cellSize / 9));

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
      title={tooltip}
    >
      <img src={objectURL} alt={sticker.name} style={imageStyle} />
      <div style={{ ...CELL_NAME_STYLE, fontSize: nameFontSize }}>
        {truncate(sticker.name, nameMaxChars)}
      </div>
      {hovered && <div style={TOOLTIP_STYLE}>{tooltip}</div>}
    </div>
  );
});
