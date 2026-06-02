import type { Command, CommandOutcome } from './command';

export const HelpCommand: Command = {
  path: ['help'],
  arity: 'none',
  run(_args, ctx): CommandOutcome {
    ctx.transitionTo('HELP');
    return { ok: true };
  },
};
