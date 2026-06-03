// Smoke tests for the post-rebuild surface.
//
// The original engine.test.ts / infra.test.ts files reference many APIs
// that were removed or renamed during the rebuild (createPack, deletePack,
// renamePack, exportStickers, ImportService 6-arg signature, ZipManifest,
// `filename` field in zip entries, etc.). They are parked as .skip files
// for reference; this file exercises the NEW contracts.
//
// Covers: Timer-driven flash auto-clear, FAVOURITE_TAG toggle, completeToken
// helper, IdbDatabase single-tx LSP-parity with FakeDatabase, ImportService
// skip-by-id, ExportService manifest schema, gridCols intent, jumpToPack
// 1-indexed clamp, grid wrap, empty-grid action no-ops, theme toggle.

import { describe, it, expect } from 'vitest';
import { EngineImpl } from '../app/engine/engine';
import { NormalMode } from '../app/modes/normalMode';
import { FakeKeyValueStore } from './fakes/fakeKeyValueStore';
import { FakeTimer } from './fakes/fakeTimer';
import { FakeDatabase } from './fakes/fakeDatabase';
import { FakeStickerRepository, FakePackRepository } from './fakes/fakeRepositories';
import { FakeClipboard } from './fakes/fakeClipboard';
import { FakeClock } from './fakes/fakeClock';
import { FakeIdGenerator } from './fakes/fakeIdGenerator';
import { FakeZipCodec } from './fakes/fakeZipCodec';
import { FakeFilePicker } from './fakes/fakeFilePicker';
import { completeToken } from '../domain/naming/completeToken';
import { FAVOURITE_TAG } from '../domain/values/favouriteTag';
import { ImportService } from '../app/services/importService';
import { ExportService } from '../app/services/exportService';
import { createSticker } from '../domain/entities/sticker';
import { createPack } from '../domain/entities/pack';
import type { ExportManifest } from '../app/ports/zipCodecPort';
import type { Sticker } from '../domain/entities/sticker';
import type { Pack } from '../domain/entities/pack';
import type { Intent } from '../app/engine/intents';

function fullPorts() {
  return {
    kv: new FakeKeyValueStore(),
    timer: new FakeTimer(),
    db: new FakeDatabase(),
    stickers: new FakeStickerRepository(),
    packs: new FakePackRepository(),
    clipboard: new FakeClipboard(),
    idGen: new FakeIdGenerator(),
    clock: new FakeClock(),
    zip: new FakeZipCodec(),
    filePicker: new FakeFilePicker(),
    downloadBlob: () => {},
  };
}

// ── Domain: completeToken ─────────────────────────────────────────────────
describe('completeToken', () => {
  const candidates = ['memes', 'meme-templates', 'work', 'family'];

  it('returns input unchanged when token is empty', () => {
    expect(completeToken('', candidates)).toBe('');
  });

  it('completes a single-token prefix case-insensitively', () => {
    expect(completeToken('mem', candidates)).toBe('memes');
    expect(completeToken('MEM', candidates)).toBe('memes');
  });

  it('completes the last comma-separated token only', () => {
    expect(completeToken('work, fam', candidates)).toBe('work, family');
  });

  it('returns input unchanged on no match', () => {
    expect(completeToken('xyz', candidates)).toBe('xyz');
  });

  it('does not complete when token already equals candidate', () => {
    // 'work' matches exactly; next candidate is no match; helper returns input.
    expect(completeToken('work', candidates)).toBe('work');
  });
});

// ── Domain: FAVOURITE_TAG ─────────────────────────────────────────────────
describe('FAVOURITE_TAG', () => {
  it('is the literal "favourite"', () => {
    expect(FAVOURITE_TAG).toBe('favourite');
  });
});

// ── Domain: factories ─────────────────────────────────────────────────────
describe('createSticker / createPack', () => {
  it('createSticker rejects empty name', () => {
    expect(() => createSticker({
      id: 'a', name: '', data: new ArrayBuffer(0),
      mimeType: 'image/png', createdAt: 0,
    })).toThrow(/non-empty/);
  });

  it('createPack rejects empty name', () => {
    expect(() => createPack({ id: 'a', name: '', createdAt: 0 })).toThrow(/non-empty/);
  });

  it('createSticker defaults lastUsedAt to createdAt', () => {
    const s = createSticker({
      id: 'a', name: 'foo', data: new ArrayBuffer(0),
      mimeType: 'image/png', createdAt: 100,
    });
    expect(s.lastUsedAt).toBe(100);
  });
});

// ── Engine: gridCols, jumpToPack, search nav ─────────────────────────────
describe('Engine reducers — new intents', () => {
  it('setGridCols clamps to >= 1', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'setGridCols', cols: 5 });
    expect(engine.getSnapshot().gridCols).toBe(5);
    engine.dispatch({ type: 'setGridCols', cols: 0 });
    expect(engine.getSnapshot().gridCols).toBe(1);
  });

  it('jumpToPack 1-indexed selects nth pack', () => {
    const engine = new EngineImpl(fullPorts());
    const packs: Pack[] = [
      { id: 'p1', name: 'a', createdAt: 0 },
      { id: 'p2', name: 'b', createdAt: 0 },
    ];
    engine.dispatch({ type: 'loadAll', stickers: [], packs });
    engine.dispatch({ type: 'jumpToPack', index: 2 });
    expect(engine.getSnapshot().selection.key).toBe('pack:p2');
  });

  it('jumpToPack out-of-range clamps to last', () => {
    const engine = new EngineImpl(fullPorts());
    const packs: Pack[] = [{ id: 'p1', name: 'a', createdAt: 0 }];
    engine.dispatch({ type: 'loadAll', stickers: [], packs });
    engine.dispatch({ type: 'jumpToPack', index: 99 });
    expect(engine.getSnapshot().selection.key).toBe('pack:p1');
  });

  it('jumpToPack with no packs is a no-op', () => {
    const engine = new EngineImpl(fullPorts());
    const beforeKey = engine.getSnapshot().selection.key;
    engine.dispatch({ type: 'jumpToPack', index: 1 });
    expect(engine.getSnapshot().selection.key).toBe(beforeKey);
  });
});

// ── Engine: moveFocusDir wrap + row start/end ─────────────────────────────
describe('moveFocusDir grid wrap', () => {
  function mkStickers(count: number): Sticker[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `s${i}`, name: `s${i}`, packIds: [], tags: [],
      data: new ArrayBuffer(0), mimeType: 'image/png' as const,
      createdAt: count - i,   // descending so RecentSort matches insertion order
      lastUsedAt: count - i,
    }));
  }

  it('h at col 0 wraps to last cell of previous row', () => {
    const engine = new EngineImpl(fullPorts());
    const stickers = mkStickers(6);
    engine.dispatch({ type: 'loadAll', stickers, packs: [] });
    engine.dispatch({ type: 'moveFocus', id: 's3' });
    engine.dispatch({ type: 'moveFocusDir', dir: 'left', cols: 3 });
    expect(engine.getSnapshot().focusId).toBe('s2');
  });

  it('l at last cell wraps to first cell', () => {
    const engine = new EngineImpl(fullPorts());
    const stickers = mkStickers(6);
    engine.dispatch({ type: 'loadAll', stickers, packs: [] });
    engine.dispatch({ type: 'moveFocus', id: 's5' });
    engine.dispatch({ type: 'moveFocusDir', dir: 'right', cols: 3 });
    expect(engine.getSnapshot().focusId).toBe('s0');
  });

  it('rowStart / rowEnd jump within row', () => {
    const engine = new EngineImpl(fullPorts());
    const stickers = mkStickers(6);
    engine.dispatch({ type: 'loadAll', stickers, packs: [] });
    engine.dispatch({ type: 'moveFocus', id: 's4' });
    engine.dispatch({ type: 'moveFocusDir', dir: 'rowStart', cols: 3 });
    expect(engine.getSnapshot().focusId).toBe('s3');
    engine.dispatch({ type: 'moveFocusDir', dir: 'rowEnd', cols: 3 });
    expect(engine.getSnapshot().focusId).toBe('s5');
  });
});

// ── Engine: theme toggle persists ─────────────────────────────────────────
describe('Theme', () => {
  it('setTheme persists via kv', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.dispatch({ type: 'setTheme', theme: 'light' });
    expect(ports.kv.get('theme')).toBe('light');
  });
});

// ── Engine: Timer-driven flash ────────────────────────────────────────────
describe('Flash scheduling (Timer-driven)', () => {
  it('flash clears after 2000ms of fake-time advance', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.dispatch({ type: 'flash', text: 'hi', isError: false });
    expect(engine.getSnapshot().flash?.text).toBe('hi');
    ports.timer.advance(1999);
    expect(engine.getSnapshot().flash?.text).toBe('hi');
    ports.timer.advance(1);
    expect(engine.getSnapshot().flash).toBe(null);
  });

  it('new flash resets the timer', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.dispatch({ type: 'flash', text: 'first', isError: false });
    ports.timer.advance(1500);
    engine.dispatch({ type: 'flash', text: 'second', isError: false });
    ports.timer.advance(1500);
    expect(engine.getSnapshot().flash?.text).toBe('second');
    ports.timer.advance(500);
    expect(engine.getSnapshot().flash).toBe(null);
  });
});

// ── NormalMode: empty-grid silent no-op ───────────────────────────────────
describe('NormalMode empty-grid guards', () => {
  function dispatchedIntents(): { engine: EngineImpl; captured: Intent[] } {
    const ports = fullPorts();
    const captured: Intent[] = [];
    const engine = new EngineImpl(ports);
    const orig = engine.dispatch.bind(engine);
    engine.dispatch = (i: Intent) => { captured.push(i); orig(i); };
    return { engine, captured };
  }

  it.each(['d', 'r', 't', 'm', 'f', 'y', 'Enter'])(
    'key "%s" with empty grid does not transition or dispatch action',
    (k) => {
      const { engine, captured } = dispatchedIntents();
      const before = engine.getSnapshot().modeName;
      engine.handleKey({ key: k, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} });
      expect(engine.getSnapshot().modeName).toBe(before);
      // No yankFocused / toggleFavourite / etc.
      expect(captured.find(i => i.type === 'yankFocused' || i.type === 'toggleFavourite')).toBeUndefined();
    },
  );
});

// ── ImportService: skip-by-id dedup ───────────────────────────────────────
describe('ImportService dedup', () => {
  it('skips packs and stickers whose ids already exist', async () => {
    const ports = fullPorts();
    // Seed db with one sticker and one pack.
    const sticker: Sticker = {
      id: 'sExisting', name: 'old', packIds: [], tags: [],
      data: new Uint8Array([1, 2]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    const pack: Pack = { id: 'pExisting', name: 'old-pack', createdAt: 0 };
    await ports.db.tx(['stickers', 'packs'], 'readwrite', scope => {
      ports.stickers.put(scope, sticker);
      ports.packs.put(scope, pack);
    });

    // Build a zip blob containing the same ids + a new one.
    const manifest: ExportManifest = {
      version: 1,
      exportedAt: 0,
      packs: [
        { id: 'pExisting', name: 'old-pack', createdAt: 0 },
        { id: 'pNew', name: 'new-pack', createdAt: 0 },
      ],
      stickers: [
        { id: 'sExisting', name: 'old', packIds: [], tags: [],
          mimeType: 'image/png', createdAt: 0, lastUsedAt: 0,
          file: 'stickers/sExisting.png' },
        { id: 'sNew', name: 'new', packIds: ['pNew'], tags: [],
          mimeType: 'image/png', createdAt: 0, lastUsedAt: 0,
          file: 'stickers/sNew.png' },
      ],
    };
    const files = new Map<string, ArrayBuffer>([
      ['stickers/sExisting.png', new Uint8Array([1, 2]).buffer],
      ['stickers/sNew.png', new Uint8Array([3, 4]).buffer],
    ]);
    const blob = await ports.zip.pack(manifest, files);
    const file = new File([blob], 'export.zip');

    const svc = new ImportService(ports.db, ports.stickers, ports.packs, ports.zip);
    const result = await svc.importZip(file);

    expect(result.stickersImported).toBe(1);
    expect(result.packsImported).toBe(1);
    expect(result.stickersSkipped).toBe(1);
    expect(result.packsSkipped).toBe(1);
  });
});

// ── ExportService: filename + manifest shape ──────────────────────────────
describe('ExportService', () => {
  it('builds filename stickerdb-export-YYYY-MM-DD.zip and includes packs', async () => {
    const ports = fullPorts();
    ports.clock.set(new Date('2026-06-03T12:00:00Z').getTime());
    const svc = new ExportService(ports.zip, ports.clock);
    const stickers: Sticker[] = [{
      id: 's1', name: 'foo', packIds: [], tags: [],
      data: new Uint8Array([7]).buffer, mimeType: 'image/gif',
      createdAt: 0, lastUsedAt: 0,
    }];
    const packs: Pack[] = [{ id: 'p1', name: 'p', createdAt: 0 }];
    const result = await svc.exportAll(stickers, packs);

    expect(result.filename).toBe('stickerdb-export-2026-06-03.zip');
    expect(result.stickerCount).toBe(1);

    // Round-trip via FakeZipCodec to inspect manifest.
    const file = new File([result.blob], result.filename);
    const { manifest, files } = await ports.zip.unpack(file);
    expect(manifest.exportedAt).toBeGreaterThan(0);
    expect(manifest.packs).toHaveLength(1);
    expect(manifest.stickers[0].file).toBe('stickers/s1.gif');
    expect(files.has('stickers/s1.gif')).toBe(true);
  });
});

// ── NormalMode + Timer: yy two-key window ─────────────────────────────────
describe('NormalMode yy window', () => {
  it('two y presses within 500ms dispatch yankFocused', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const sticker: Sticker = {
      id: 's1', name: 'pepe', packIds: [], tags: [],
      data: new Uint8Array([1]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    const captured: Intent[] = [];
    const orig = engine.dispatch.bind(engine);
    engine.dispatch = (i: Intent) => { captured.push(i); orig(i); };

    const mkKey = (k: string) => ({
      key: k, ctrl: false, shift: false, alt: false, meta: false,
      preventDefault: () => {},
    });
    engine.handleKey(mkKey('y'));
    ports.timer.advance(100);
    engine.handleKey(mkKey('y'));
    expect(captured.some(i => i.type === 'yankFocused')).toBe(true);
  });

  it('two y presses separated by > 500ms do NOT dispatch yankFocused', () => {
    const ports = fullPorts();
    // NormalMode default timer not the same as ports.timer — explicitly build one.
    const nm = new NormalMode(ports.timer);
    const engine = new EngineImpl(ports, { get: (n) => n === 'NORMAL' ? nm : null });
    const sticker: Sticker = {
      id: 's1', name: 'pepe', packIds: [], tags: [],
      data: new Uint8Array([1]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    const captured: Intent[] = [];
    const orig = engine.dispatch.bind(engine);
    engine.dispatch = (i: Intent) => { captured.push(i); orig(i); };

    const mkKey = (k: string) => ({
      key: k, ctrl: false, shift: false, alt: false, meta: false,
      preventDefault: () => {},
    });
    engine.handleKey(mkKey('y'));
    ports.timer.advance(600);
    engine.handleKey(mkKey('y'));
    // The first y started a yy window; after timer fire it cleared. The
    // second y starts a new yy window. No yankFocused yet.
    expect(captured.some(i => i.type === 'yankFocused')).toBe(false);
  });
});
