import type { Mode } from './mode';
import type { ModeName } from '../../domain/values/modeName';
import type { Timer } from '../ports/timer';
import type { CommandContext } from '../engine/commandContext';
import { NormalMode } from './normalMode';
import { SearchMode } from './searchMode';
import { CommandMode } from './commandMode';
import { ConfirmMode } from './confirmMode';
import { RenameMode } from './renameMode';
import { TagsMode } from './tagsMode';
import { PackAssignMode } from './packAssignMode';
import { UploadMode } from './uploadMode';
import { HelpMode } from './helpMode';
import { CommandRegistry } from '../commands/registry';
import {
  PackNewCommand, PackRenameCommand, PackDeleteCommand, PackMoveCommand,
} from '../commands/packCommands';
import {
  TagAddCommand, TagRemoveCommand, TagRenameCommand, TagClearCommand,
  TagsAddCommand, TagsRemoveCommand, TagsRenameCommand, TagsClearCommand,
} from '../commands/tagCommands';
import { SortCommand } from '../commands/sortCommands';
import { ThemeCommand } from '../commands/themeCommands';
import { HelpCommand } from '../commands/helpCommand';
import { ExportCommand, ImportCommand } from '../commands/ioCommands';

function buildCommandRegistry(): CommandRegistry {
  const reg = new CommandRegistry();
  // Pack commands
  reg.register(PackNewCommand);
  reg.register(PackRenameCommand);
  reg.register(PackDeleteCommand);
  reg.register(PackMoveCommand);
  // Tag commands (singular SPEC form)
  reg.register(TagAddCommand);
  reg.register(TagRemoveCommand);
  reg.register(TagRenameCommand);
  reg.register(TagClearCommand);
  // Tag commands (plural aliases for backwards-compat / convenience)
  reg.register(TagsAddCommand);
  reg.register(TagsRemoveCommand);
  reg.register(TagsRenameCommand);
  reg.register(TagsClearCommand);
  // Misc
  reg.register(SortCommand);
  reg.register(ThemeCommand);
  reg.register(HelpCommand);
  reg.register(ExportCommand);
  reg.register(ImportCommand);
  return reg;
}

// ── ModeRegistry ──────────────────────────────────────────────────────────────
//
// Holds one singleton Mode instance per ModeName. Constructed by the engine
// with the Timer port (for NormalMode buffers) and a getCtx closure (for
// CommandMode to access the richer CommandContext).
export class ModeRegistry {
  private readonly modes: ReadonlyMap<ModeName, Mode>;

  constructor(getCtx: () => CommandContext, timer: Timer = defaultTimer()) {
    const cmdRegistry = buildCommandRegistry();
    this.modes = new Map<ModeName, Mode>([
      ['NORMAL',     new NormalMode(timer)],
      ['SEARCH',     new SearchMode()],
      ['COMMAND',    new CommandMode(cmdRegistry, getCtx)],
      ['CONFIRM',    new ConfirmMode()],
      ['RENAME',     new RenameMode()],
      ['TAGS',       new TagsMode()],
      ['PACKASSIGN', new PackAssignMode()],
      ['UPLOAD',     new UploadMode()],
      ['HELP',       new HelpMode()],
    ]);
  }

  get(name: ModeName): Mode | null {
    return this.modes.get(name) ?? null;
  }
}

// Default Timer when EngineImpl doesn't pass one (tests). Real engine wires
// the injected Timer; this is a fallback for ModeRegistry's constructor sig.
function defaultTimer(): Timer {
  return {
    setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
    clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
  };
}
