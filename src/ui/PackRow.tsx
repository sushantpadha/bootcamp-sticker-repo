import { useState } from 'react';
import type { SidebarSelection } from '../domain/selection/sidebarSelection';
import {
  SIDEBAR_ROW_STYLE, SIDEBAR_ROW_ACTIVE_STYLE,
  PACK_NAME_MAX, truncate,
} from './theme/styles';

interface Props {
  selection: SidebarSelection;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

// SPEC format: "> memes [12]" (active) or "  memes [12]" (inactive).
// The leading "> " vs "  " (two chars) preserves monospace alignment.
export function PackRow({ selection, count, isActive, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const style = {
    ...SIDEBAR_ROW_STYLE,
    ...(isActive || hovered ? SIDEBAR_ROW_ACTIVE_STYLE : {}),
  };
  const marker = isActive ? '> ' : '  ';
  const label = truncate(selection.label(), PACK_NAME_MAX);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      {marker}{label} [{count}]
    </div>
  );
}
