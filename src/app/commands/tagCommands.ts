import type { Command, CommandOutcome } from './command';
import type { Engine } from '../engine/engineHandle';

function getFocusedSticker(engine: Engine) {
  const snap = engine.getSnapshot();
  if (!snap.focusId) return null;
  return snap.stickers.find(s => s.id === snap.focusId) ?? null;
}

export const TagsAddCommand: Command = {
  path: ['tags', 'add'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    const sticker = getFocusedSticker(engine);
    if (!sticker) return { ok: false, flash: 'E: no sticker focused' };
    const tag = args[0]?.trim();
    if (!tag) return { ok: false, flash: 'E: tag required' };
    if (sticker.tags.includes(tag)) return { ok: true };
    engine.dispatch({ type: 'setTags', tags: [...sticker.tags, tag] });
    return { ok: true };
  },
};

export const TagsRemoveCommand: Command = {
  path: ['tags', 'remove'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    const sticker = getFocusedSticker(engine);
    if (!sticker) return { ok: false, flash: 'E: no sticker focused' };
    const tag = args[0]?.trim();
    if (!tag) return { ok: false, flash: 'E: tag required' };
    engine.dispatch({ type: 'setTags', tags: sticker.tags.filter(t => t !== tag) });
    return { ok: true };
  },
};

export const TagsClearCommand: Command = {
  path: ['tags', 'clear'],
  arity: 'none',
  run(_args, engine): CommandOutcome {
    const sticker = getFocusedSticker(engine);
    if (!sticker) return { ok: false, flash: 'E: no sticker focused' };
    engine.dispatch({ type: 'setTags', tags: [] });
    return { ok: true };
  },
};
