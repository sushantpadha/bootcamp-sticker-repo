import type { Mode } from './mode';
import type { ModeName } from '../../domain/values/modeName';
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
import { PackNewCommand, PackRenameCommand, PackDeleteCommand } from '../commands/packCommands';
import { TagsAddCommand, TagsRemoveCommand, TagsClearCommand } from '../commands/tagCommands';
import { SortCommand } from '../commands/sortCommands';
import { ThemeCommand } from '../commands/themeCommands';
import { HelpCommand } from '../commands/helpCommand';
import { ExportCommand, ImportCommand } from '../commands/ioCommands';

function buildCommandRegistry(): CommandRegistry {
  const reg = new CommandRegistry();
  reg.register(PackNewCommand);
  reg.register(PackRenameCommand);
  reg.register(PackDeleteCommand);
  reg.register(TagsAddCommand);
  reg.register(TagsRemoveCommand);
  reg.register(TagsClearCommand);
  reg.register(SortCommand);
  reg.register(ThemeCommand);
  reg.register(HelpCommand);
  reg.register(ExportCommand);
  reg.register(ImportCommand);
  return reg;
}

// ── ModeRegistry ──────────────────────────────────────────────────────────────
//
// Holds one singleton Mode instance per registered ModeName. The engine calls
// get() when entering or exiting a mode during transitionTo().
export class ModeRegistry {
  private readonly modes: ReadonlyMap<ModeName, Mode>;

  constructor() {
    const cmdRegistry = buildCommandRegistry();
    this.modes = new Map<ModeName, Mode>([
      ['NORMAL',     new NormalMode()],
      ['SEARCH',     new SearchMode()],
      ['COMMAND',    new CommandMode(cmdRegistry)],
      ['CONFIRM',    new ConfirmMode()],
      ['RENAME',     new RenameMode()],
      ['TAGS',       new TagsMode()],
      ['PACKASSIGN', new PackAssignMode()],
      ['UPLOAD',     new UploadMode()],
      ['HELP',       new HelpMode()],
    ]);
  }

  // Returns the Mode for name, or null if not yet registered.
  get(name: ModeName): Mode | null {
    return this.modes.get(name) ?? null;
  }
}
