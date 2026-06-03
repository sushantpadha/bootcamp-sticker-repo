import type { Command, CommandOutcome } from './command';

export const ThemeCommand: Command = {
  path: ['theme'],
  arity: 'one',
  run(args, ctx): CommandOutcome {
    const which = args[0];
    const current = ctx.getSnapshot().theme;
    let next: 'dark' | 'light';
    if (which === 'dark' || which === 'light') {
      next = which;
    } else if (which === 'toggle') {
      next = current === 'dark' ? 'light' : 'dark';
    } else {
      return { ok: false, flash: `E: unknown theme "${which ?? ''}"` };
    }
    ctx.dispatch({ type: 'setTheme', theme: next });
    ctx.setFlash(`theme: ${next}`, false);
    return { ok: true };
  },
};
