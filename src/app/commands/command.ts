import type { Engine } from '../engine/engineHandle';

export type CommandOutcome =
  | { ok: true; flash?: string }
  | { ok: false; flash: string };

// [LSP] TOTAL: run() always returns CommandOutcome, never throws, never partially
// mutates then fails (atomic). The runner handles all commands identically — that
// uniform postcondition is the substitution guarantee. (DOMAIN.md §Command)
export interface Command {
  readonly path: readonly string[];        // e.g. ['pack', 'new']
  readonly arity: 'none' | 'one' | 'rest'; // for arg parsing + completion
  run(args: string[], engine: Engine): CommandOutcome;
}
