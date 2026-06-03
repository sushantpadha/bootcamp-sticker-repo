import type { Command, CommandOutcome } from './command';

export const ExportCommand: Command = {
  path: ['export'],
  arity: 'none',
  async run(_args, ctx): Promise<CommandOutcome> {
    const { stickers, packs } = ctx.getSnapshot();
    if (stickers.length === 0 && packs.length === 0) {
      ctx.setFlash('E: nothing to export', true);
      return { ok: true };
    }
    try {
      const result = await ctx.services.export.exportAll(stickers, packs);
      ctx.ports.downloadBlob(result.blob, result.filename);
      ctx.setFlash(`exporting... done: ${result.stickerCount} stickers`, false);
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};

export const ImportCommand: Command = {
  path: ['import'],
  arity: 'none',
  async run(_args, ctx): Promise<CommandOutcome> {
    try {
      const file = await ctx.ports.filePicker.pickZip();
      if (!file) return { ok: true }; // user cancelled
      const result = await ctx.services.import.importZip(file);
      const skipped = result.stickersSkipped + result.packsSkipped;
      // Refresh in-memory state by re-reading.
      const { stickers, packs } = await ctx.ports.db.tx(['stickers', 'packs'], 'readonly', scope => ({
        stickers: ctx.ports.stickers.getAll(scope),
        packs: ctx.ports.packs.getAll(scope),
      }));
      ctx.dispatch({ type: 'loadAll', stickers, packs });
      ctx.setFlash(
        `imported: ${result.stickersImported} stickers, ${result.packsImported} packs (${skipped} skipped)`,
        false,
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, flash: `E: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
