import type { CommandContext } from '../engine/commandContext';

export type CommandOutcome =
  | { ok: true; flash?: string }
  | { ok: false; flash: string };

// [LSP] TOTAL: run() may resolve asynchronously but never throws synchronously;
//       returns CommandOutcome (or Promise<CommandOutcome>). Atomic — no
//       partial-mutation-then-fail. DOMAIN.md §Command.
export interface Command {
  readonly path: readonly string[];        // e.g. ['pack', 'new']
  readonly arity: 'none' | 'one' | 'rest' | 'two';
  run(args: string[], ctx: CommandContext): CommandOutcome | Promise<CommandOutcome>;
}
