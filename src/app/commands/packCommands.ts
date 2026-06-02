import type { Command, CommandOutcome } from './command';
import type { Engine } from '../engine/engineHandle';
import { PackSelection } from '../../domain/selection/sidebarSelection';

// Returns the active PackSelection, or null. Pack rename/delete must check this
// and return 'E: no pack selected' if null — the check belongs here, not in the
// service, per DOMAIN.md §SidebarSelection and M7 acceptance criteria.
function getPackSelection(engine: Engine): PackSelection | null {
  const sel = engine.getSnapshot().selection;
  return sel instanceof PackSelection ? sel : null;
}

export const PackNewCommand: Command = {
  path: ['pack', 'new'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    const name = args[0]?.trim();
    if (!name) return { ok: false, flash: 'E: pack name required' };
    // Persistence is wired in M8 (PackService); for now apply to in-memory state.
    engine.dispatch({
      type: 'applyPack',
      pack: { id: `tmp-${Date.now()}`, name, createdAt: Date.now() },
    });
    return { ok: true, flash: `pack "${name}" created` };
  },
};

export const PackRenameCommand: Command = {
  path: ['pack', 'rename'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    const packSel = getPackSelection(engine);
    if (!packSel) return { ok: false, flash: 'E: no pack selected' };

    const newName = args[0]?.trim();
    if (!newName) return { ok: false, flash: 'E: new name required' };

    const existing = engine.getSnapshot().packs.find(p => p.id === packSel.id);
    if (!existing) return { ok: false, flash: 'E: pack not found' };

    engine.dispatch({ type: 'applyPack', pack: { ...existing, name: newName } });
    // Keep the active selection in sync with the new name.
    engine.dispatch({
      type: 'setSelection',
      selection: new PackSelection(existing.id, newName),
    });
    return { ok: true, flash: `pack renamed to "${newName}"` };
  },
};

export const PackDeleteCommand: Command = {
  path: ['pack', 'delete'],
  arity: 'none',
  run(_args, engine): CommandOutcome {
    const packSel = getPackSelection(engine);
    if (!packSel) return { ok: false, flash: 'E: no pack selected' };
    engine.dispatch({ type: 'removePack', id: packSel.id });
    return { ok: true, flash: 'pack deleted' };
  },
};
