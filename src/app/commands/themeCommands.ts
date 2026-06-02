import type { Command, CommandOutcome } from './command';

export const ThemeCommand: Command = {
  path: ['theme'],
  arity: 'one',
  run(args, engine): CommandOutcome {
    const which = args[0];
    if (which === 'dark' || which === 'light') {
      engine.dispatch({ type: 'setTheme', theme: which });
      return { ok: true };
    }
    return { ok: false, flash: `E: unknown theme "${which ?? ''}"` };
  },
};
