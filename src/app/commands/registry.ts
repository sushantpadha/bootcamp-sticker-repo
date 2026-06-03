import type { CommandContext } from '../engine/commandContext';
import type { Command, CommandOutcome } from './command';

// Trie / longest-path resolver. Registered commands are stored; on run(input)
// the first command whose path matches the longest prefix of tokens wins.
// E492 on miss.
export class CommandRegistry {
  private readonly commands: Command[] = [];

  register(command: Command): void {
    this.commands.push(command);
  }

  // Returns the unique first-token set across registered command paths.
  // Used by CommandMode Tab autocomplete.
  firstTokens(): string[] {
    return Array.from(new Set(this.commands.map(c => c.path[0])));
  }

  async run(input: string, ctx: CommandContext): Promise<CommandOutcome> {
    const trimmed = input.trim();
    if (!trimmed) return { ok: true };
    const tokens = trimmed.split(/\s+/);

    const candidates = [...this.commands].sort((a, b) => b.path.length - a.path.length);
    for (const cmd of candidates) {
      const plen = cmd.path.length;
      if (tokens.length < plen) continue;
      if (cmd.path.every((p, i) => p === tokens[i])) {
        try {
          return await cmd.run(tokens.slice(plen), ctx);
        } catch (err) {
          return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
        }
      }
    }
    return { ok: false, flash: `E492: Not an editor command: ${trimmed}` };
  }
}
