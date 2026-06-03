import type { AppState } from '../app/engine/appState';
import type { Intent } from '../app/engine/intents';
import {
  AllSelection, PackSelection, UngroupedSelection,
} from '../domain/selection/sidebarSelection';
import type { SidebarSelection } from '../domain/selection/sidebarSelection';
import { PackRow } from './PackRow';
import { SIDEBAR_HEADER_STYLE } from './theme/styles';

interface Props {
  snapshot: AppState;
  dispatch: (intent: Intent) => void;
}

export function Sidebar({ snapshot, dispatch }: Props) {
  const { stickers, packs, selection } = snapshot;

  const allSel = new AllSelection();
  const packSels = packs.map(p => new PackSelection(p.id, p.name));
  const ungroupedSel = new UngroupedSelection();

  const rows: { sel: SidebarSelection; count: number }[] = [
    { sel: allSel, count: stickers.length },
    ...packSels.map(sel => ({
      sel,
      count: stickers.filter(s => s.packIds.includes(sel.id)).length,
    })),
    { sel: ungroupedSel, count: stickers.filter(s => s.packIds.length === 0).length },
  ];

  return (
    <div>
      <div style={SIDEBAR_HEADER_STYLE}>
        <span>PACKS</span>
        <span>[{stickers.length}]</span>
      </div>
      {rows.map(({ sel, count }) => (
        <PackRow
          key={sel.key}
          selection={sel}
          count={count}
          isActive={selection.key === sel.key}
          onClick={() => dispatch({ type: 'setSelection', selection: sel })}
        />
      ))}
    </div>
  );
}
