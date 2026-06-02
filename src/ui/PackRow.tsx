import { useState } from 'react';
import type { SidebarSelection } from '../domain/selection/sidebarSelection';

interface Props {
  selection: SidebarSelection;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

export function PackRow({ selection, count, isActive, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  const bg = isActive || hovered ? (isActive ? 'var(--bg-selection)' : 'var(--bg-cell-hover)') : undefined;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 12px',
        cursor: 'pointer',
        background: bg,
        color: isActive ? 'var(--text-bright)' : 'var(--text-dim)',
        minWidth: 0,
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {selection.label()}
      </span>
      <span style={{ color: 'var(--text-muted)', marginLeft: 6, flexShrink: 0, fontSize: 11 }}>
        {count}
      </span>
    </div>
  );
}
