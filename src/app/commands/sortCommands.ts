import type { Command, CommandOutcome } from './command';
import { RecentSort, AddedSort, NameSort } from '../../domain/sort/stickerSort';

export const SortCommand: Command = {
  path: ['sort'],
  arity: 'one',
  run(args, ctx): CommandOutcome {
    switch (args[0]) {
      case 'recent':
        ctx.dispatch({ type: 'setSort', sort: RecentSort });
        ctx.setFlash('sort: recent', false);
        return { ok: true };
      case 'added':
        ctx.dispatch({ type: 'setSort', sort: AddedSort });
        ctx.setFlash('sort: added', false);
        return { ok: true };
      case 'name':
        ctx.dispatch({ type: 'setSort', sort: NameSort });
        ctx.setFlash('sort: name', false);
        return { ok: true };
      default:
        return { ok: false, flash: `E: unknown sort "${args[0] ?? ''}"` };
    }
  },
};
