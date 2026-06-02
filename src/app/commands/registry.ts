import type { Engine } from '../engine/engineHandle';
import type { Command, CommandOutcome } from './command';

// Resolves a text input string against registered commands using longest-path
// (greedy trie) matching. The first token(s) are the command path; any remaining
// tokens become args. Unmatched input returns E492 per DOMAIN.md §Command.
export class CommandRegistry {
  private readonly commands: Command[] = [];

  register(command: Command): void {
    this.commands.push(command);
  }

  run(input: string, engine: Engine): CommandOutcome {
    const trimmed = input.trim();
    if (!trimmed) return { ok: true };

    const tokens = trimmed.split(/\s+/);

    // Longest path wins — sort by path length descending so the most specific
    // command is tried first (e.g. 'pack rename' beats 'pack').
    const candidates = [...this.commands].sort((a, b) => b.path.length - a.path.length);

    for (const cmd of candidates) {
      const plen = cmd.path.length;
      if (tokens.length < plen) continue;
      if (cmd.path.every((p, i) => p === tokens[i])) {
        return cmd.run(tokens.slice(plen), engine);
      }
    }

    return { ok: false, flash: `E492: Not an editor command: ${trimmed}` };
  }
}
