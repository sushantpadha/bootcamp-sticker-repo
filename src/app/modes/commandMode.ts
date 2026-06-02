import type { Mode, KeyEvent, StatuslineModel, OverlayModel } from './mode';
import type { Engine } from '../engine/engineHandle';
import type { CommandRegistry } from '../commands/registry';
import type { CommandContext } from '../engine/commandContext';
import { completeToken } from '../../domain/naming/completeToken';

// CommandMode — ex-style command entry.
// Tab autocompletes the first token (DOMAIN.md §:command).
// Enter runs via the injected CommandRegistry; result flash + return to NORMAL
// unless the command itself changed the mode (e.g. :help).
export class CommandMode implements Mode {
  readonly name = 'COMMAND' as const;
  private readonly registry: CommandRegistry;
  private readonly getCtx: () => CommandContext;

  constructor(registry: CommandRegistry, getCtx: () => CommandContext) {
    this.registry = registry;
    this.getCtx = getCtx;
  }

  onEnter(engine: Engine): void {
    engine.setStatusInput('');
  }

  handleKey(evt: KeyEvent, engine: Engine): void {
    const { key, ctrl, alt, meta } = evt;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Enter' || key === 'Tab' || key === 'Escape') evt.preventDefault();

    if (key === 'Escape') {
      engine.transitionTo('NORMAL');
      return;
    }

    if (key === 'Tab') {
      // First-token autocomplete only (per SPEC §Command Palette).
      const cur = engine.getStatusInput();
      if (cur.includes(' ')) return; // past the first token; no-op
      const next = completeToken(cur, this.registry.firstTokens());
      engine.setStatusInput(next);
      return;
    }

    if (key === 'Enter') {
      const input = engine.getStatusInput();
      const ctx = this.getCtx();
      const modeBefore = engine.getSnapshot().modeName;
      // Run async; we transition back optimistically. Async commands handle
      // their own flashes; sync commands give us an immediate outcome.
      const result = this.registry.run(input, ctx);
      Promise.resolve(result).then(outcome => {
        if (outcome.flash !== undefined) {
          engine.setFlash(outcome.flash, !outcome.ok);
        }
      });
      // Only return to NORMAL if the command didn't itself change mode.
      if (engine.getSnapshot().modeName === modeBefore) {
        engine.transitionTo('NORMAL');
      }
      return;
    }

    if (!ctrl && !alt && !meta) {
      if (key === 'Backspace') {
        engine.setStatusInput(engine.getStatusInput().slice(0, -1));
        return;
      }
      if (key.length === 1) {
        engine.setStatusInput(engine.getStatusInput() + key);
        return;
      }
    }
  }

  statusline(engine: Engine): StatuslineModel {
    return { mode: 'COMMAND', input: `:${engine.getStatusInput()}` };
  }

  overlay(_engine: Engine): OverlayModel | null { return null; }

  onExit(engine: Engine): void {
    engine.setStatusInput('');
  }
}
