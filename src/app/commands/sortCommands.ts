import type { Command, CommandOutcome } from './command';
import { RecentSort, AddedSort, NameSort } from '../../domain/sort/stickerSort';

export const SortCommand: Command = {
  path: ['sort'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    switch (args[0]) {
      case 'recent': engine.dispatch({ type: 'setSort', sort: RecentSort }); return { ok: true };
      case 'added':  engine.dispatch({ type: 'setSort', sort: AddedSort });  return { ok: true };
      case 'name':   engine.dispatch({ type: 'setSort', sort: NameSort });   return { ok: true };
      default:
        return { ok: false, flash: `E: unknown sort "${args[0] ?? ''}"` };
    }
  },
};
