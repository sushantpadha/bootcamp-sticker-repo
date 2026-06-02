import { memo, useState } from 'react';
import type { Sticker } from '../domain/entities/sticker';
import type { Pack } from '../domain/entities/pack';
import {
  CELL_STYLE, CELL_FOCUSED_STYLE, CELL_HOVER_STYLE, CELL_IMAGE_STYLE,
  CELL_NAME_STYLE, TOOLTIP_STYLE, STICKER_NAME_MAX, truncate,
} from './theme/styles';

interface Props {
  sticker: Sticker;
  isFocused: boolean;
  objectURL: string;
  packs: Pack[];
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
  sticker, isFocused, objectURL, packs, onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const tooltip = buildTooltip(sticker, packs);

  const style = {
    ...CELL_STYLE,
    ...(isFocused ? CELL_FOCUSED_STYLE : {}),
    ...(hovered ? CELL_HOVER_STYLE : {}),
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
      title={tooltip}
    >
      <img src={objectURL} alt={sticker.name} style={CELL_IMAGE_STYLE} />
      <div style={CELL_NAME_STYLE}>{truncate(sticker.name, STICKER_NAME_MAX)}</div>
      {hovered && <div style={TOOLTIP_STYLE}>{tooltip}</div>}
    </div>
  );
});
