import type { Command, CommandOutcome } from './command';
import type { CommandContext } from '../engine/commandContext';
import { PackSelection } from '../../domain/selection/sidebarSelection';

function getPackSelection(ctx: CommandContext): PackSelection | null {
  const sel = ctx.getSnapshot().selection;
  return sel instanceof PackSelection ? sel : null;
}

export const PackNewCommand: Command = {
  path: ['pack', 'new'],
  arity: 'one',
  async run(args, ctx): Promise<CommandOutcome> {
    const name = args.join(' ').trim();
    if (!name) return { ok: false, flash: 'E: pack name required' };
    try {
      const pack = await ctx.services.pack.createPackWithName(name, ctx.getSnapshot().packs);
      ctx.dispatch({ type: 'flash', text: `pack "${pack.name}" created`, isError: false });
      // Apply to in-memory state too (engine routes flash but doesn't know
      // about new packs from this command; we use dispatch flash which is
      // safe, but we also need the pack to appear in state.packs).
      // The cleanest path: let the engine apply via an internal change.
      // For now, dispatch a no-flash setSelection that triggers a re-read?
      // Better: expose a public-but-engine-internal route. We piggyback on
      // `setTheme`-style: the engine's internal applyPack happens via the
      // service path normally. Here we have a pack but no service callback,
      // so do a fresh load via the existing `loadAll` intent.
      const { stickers, packs } = ctx.getSnapshot();
      const exists = packs.find(p => p.id === pack.id);
      if (!exists) {
        ctx.dispatch({ type: 'loadAll', stickers, packs: [...packs, pack] });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const PackRenameCommand: Command = {
  path: ['pack', 'rename'],
  arity: 'one',
  async run(args, ctx): Promise<CommandOutcome> {
    const packSel = getPackSelection(ctx);
    if (!packSel) return { ok: false, flash: 'E: no pack selected' };
    const newName = args.join(' ').trim();
    if (!newName) return { ok: false, flash: 'E: new name required' };

    const snap = ctx.getSnapshot();
    const existing = snap.packs.find(p => p.id === packSel.id);
    if (!existing) return { ok: false, flash: 'E: pack not found' };

    try {
      const updated = await ctx.services.pack.renamePackTo(existing, newName, snap.packs);
      ctx.dispatch({
        type: 'loadAll',
        stickers: snap.stickers,
        packs: snap.packs.map(p => p.id === updated.id ? updated : p),
      });
      ctx.dispatch({
        type: 'setSelection',
        selection: new PackSelection(updated.id, updated.name),
      });
      ctx.setFlash(`pack renamed to "${updated.name}"`, false);
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const PackDeleteCommand: Command = {
  path: ['pack', 'delete'],
  arity: 'none',
  async run(_args, ctx): Promise<CommandOutcome> {
    const packSel = getPackSelection(ctx);
    if (!packSel) return { ok: false, flash: 'E: no pack selected' };
    const snap = ctx.getSnapshot();
    const pack = snap.packs.find(p => p.id === packSel.id);
    if (!pack) return { ok: false, flash: 'E: pack not found' };

    try {
      const affected = await ctx.services.pack.deletePackAndCleanup(pack.id, snap.stickers);
      // Reload state (drop pack, strip its id from affected stickers).
      const newPacks = snap.packs.filter(p => p.id !== pack.id);
      const newStickers = snap.stickers.map(s =>
        s.packIds.includes(pack.id)
          ? { ...s, packIds: s.packIds.filter(id => id !== pack.id) }
          : s,
      );
      ctx.dispatch({ type: 'loadAll', stickers: newStickers, packs: newPacks });
      ctx.setFlash(`pack "${pack.name}" deleted (${affected} stickers updated)`, false);
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const PackMoveCommand: Command = {
  path: ['pack', 'move'],
  arity: 'one',
  async run(args, ctx): Promise<CommandOutcome> {
    const name = args.join(' ').trim();
    if (!name) return { ok: false, flash: 'E: pack name required' };
    const snap = ctx.getSnapshot();
    const focused = snap.stickers.find(s => s.id === snap.focusId);
    if (!focused) return { ok: true }; // empty-grid silent no-op

    try {
      const result = await ctx.services.pack.movePackForSticker(
        focused, name, snap.packs, snap.stickers,
      );
      if (result.alreadyMember) {
        ctx.setFlash(`already in pack "${result.pack.name}"`, false);
        return { ok: true };
      }
      const newPacks = result.created ? [...snap.packs, result.pack] : snap.packs;
      const newStickers = snap.stickers.map(s =>
        s.id === result.sticker.id ? result.sticker : s,
      );
      ctx.dispatch({ type: 'loadAll', stickers: newStickers, packs: newPacks });
      ctx.setFlash(
        result.created
          ? `moved to pack "${result.pack.name}" (created)`
          : `moved to pack "${result.pack.name}"`,
        false,
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
