import type { Command, CommandOutcome } from './command';

// Stubs wired to ExportService / ImportService in M8.
export const ExportCommand: Command = {
  path: ['export'],
  arity: 'none',
  run(_args, _engine): CommandOutcome {
    return { ok: true };
  },
};

export const ImportCommand: Command = {
  path: ['import'],
  arity: 'none',
  run(_args, _engine): CommandOutcome {
    return { ok: true };
  },
};
