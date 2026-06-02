import type { Command, CommandOutcome } from './command';

export const HelpCommand: Command = {
  path: ['help'],
  arity: 'none',
  run(_args, engine): CommandOutcome {
    engine.transitionTo('HELP');
    return { ok: true };
  },
};
