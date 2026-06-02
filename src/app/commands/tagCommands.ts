import type { Command, CommandOutcome } from './command';
import type { CommandContext } from '../engine/commandContext';

function getFocusedSticker(ctx: CommandContext) {
  const snap = ctx.getSnapshot();
  if (!snap.focusId) return null;
  return snap.stickers.find(s => s.id === snap.focusId) ?? null;
}

// Singular SPEC form. Plural-path aliases registered alongside in registry.
export const TagAddCommand: Command = {
  path: ['tag', 'add'],
  arity: 'one',
  run(args, ctx): CommandOutcome {
    const sticker = getFocusedSticker(ctx);
    if (!sticker) return { ok: true }; // empty-grid silent no-op
    const tag = args.join(' ').trim();
    if (!tag) return { ok: false, flash: 'E: tag required' };
    if (sticker.tags.includes(tag)) return { ok: true };
    ctx.dispatch({ type: 'setTags', tags: [...sticker.tags, tag] });
    ctx.setFlash(`tagged: ${tag}`, false);
    return { ok: true };
  },
};

export const TagRemoveCommand: Command = {
  path: ['tag', 'remove'],
  arity: 'one',
  run(args, ctx): CommandOutcome {
    const sticker = getFocusedSticker(ctx);
    if (!sticker) return { ok: true };
    const tag = args.join(' ').trim();
    if (!tag) return { ok: false, flash: 'E: tag required' };
    if (!sticker.tags.includes(tag)) return { ok: true };
    ctx.dispatch({ type: 'setTags', tags: sticker.tags.filter(t => t !== tag) });
    ctx.setFlash(`untagged: ${tag}`, false);
    return { ok: true };
  },
};

export const TagRenameCommand: Command = {
  path: ['tag', 'rename'],
  arity: 'two',
  async run(args, ctx): Promise<CommandOutcome> {
    const [oldName, newName] = args;
    if (!oldName || !newName) return { ok: false, flash: 'E: usage: :tag rename <old> <new>' };
    try {
      const snap = ctx.getSnapshot();
      const affected = await ctx.services.tag.renameTagGlobally(oldName, newName, snap.stickers);
      // Apply the rename to in-memory state by reloading.
      const newStickers = snap.stickers.map(s =>
        s.tags.includes(oldName)
          ? { ...s, tags: Array.from(new Set(s.tags.map(t => t === oldName ? newName : t))) }
          : s,
      );
      ctx.dispatch({ type: 'loadAll', stickers: newStickers, packs: snap.packs });
      ctx.setFlash(`renamed tag "${oldName}" → "${newName}" (${affected} stickers)`, false);
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

// Power-user shortcut (not in SPEC; kept).
export const TagClearCommand: Command = {
  path: ['tag', 'clear'],
  arity: 'none',
  run(_args, ctx): CommandOutcome {
    const sticker = getFocusedSticker(ctx);
    if (!sticker) return { ok: true };
    ctx.dispatch({ type: 'setTags', tags: [] });
    return { ok: true };
  },
};

// ── Plural-path aliases (current code used plural; keep as aliases) ──────
// Same impls under a different `path` prefix so user typing `:tags add foo`
// also works (DECISIONS §14b).
function aliasAs(plural: string, cmd: Command): Command {
  return { ...cmd, path: [plural, cmd.path[1]] };
}
export const TagsAddCommand    = aliasAs('tags', TagAddCommand);
export const TagsRemoveCommand = aliasAs('tags', TagRemoveCommand);
export const TagsRenameCommand = aliasAs('tags', TagRenameCommand);
export const TagsClearCommand  = aliasAs('tags', TagClearCommand);
