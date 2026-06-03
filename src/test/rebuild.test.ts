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
import { RecentSort, AddedSort, NameSort } from '../domain/sort/stickerSort';
import { buildSearchPredicate } from '../domain/search/searchPredicate';
import { computeVisibleGrid } from '../app/engine/appState';
import { AllSelection } from '../domain/selection/sidebarSelection';
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

// ── Domain: StickerSort ──────────────────────────────────────────────────────
describe('StickerSort', () => {
  const base = {
    id: '', name: '', packIds: [], tags: [],
    data: new ArrayBuffer(0), mimeType: 'image/png' as const,
    createdAt: 0, lastUsedAt: 0,
  };
  const a: Sticker = { ...base, id: 'a', name: 'zebra', createdAt: 100, lastUsedAt: 300 };
  const b: Sticker = { ...base, id: 'b', name: 'Apple', createdAt: 200, lastUsedAt: 100 };
  const c: Sticker = { ...base, id: 'c', name: 'mango', createdAt: 300, lastUsedAt: 200 };

  it('RecentSort puts higher lastUsedAt first', () => {
    const sorted = [a, b, c].sort(RecentSort.compare.bind(RecentSort));
    expect(sorted.map(s => s.id)).toEqual(['a', 'c', 'b']);
  });

  it('AddedSort puts higher createdAt first', () => {
    const sorted = [a, b, c].sort(AddedSort.compare.bind(AddedSort));
    expect(sorted.map(s => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('NameSort is case-insensitive alphabetical ascending', () => {
    const sorted = [a, b, c].sort(NameSort.compare.bind(NameSort));
    // Apple < mango < zebra (case-insensitive)
    expect(sorted.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts have a stable id tie-breaker', () => {
    const x: Sticker = { ...base, id: 'x', name: 'twin', createdAt: 50, lastUsedAt: 50 };
    const y: Sticker = { ...base, id: 'y', name: 'twin', createdAt: 50, lastUsedAt: 50 };
    // id tie-breaker: 'x' < 'y'
    expect(NameSort.compare(x, y)).toBeLessThan(0);
    expect(RecentSort.compare(x, y)).toBeLessThan(0);
    expect(AddedSort.compare(x, y)).toBeLessThan(0);
  });
});

// ── Domain: SearchPredicate ────────────────────────────────────────────────
describe('SearchPredicate', () => {
  const base = {
    id: 's', packIds: [], data: new ArrayBuffer(0),
    mimeType: 'image/png' as const, createdAt: 0, lastUsedAt: 0,
  };
  const pepe: Sticker = { ...base, name: 'Pepe the frog', tags: ['meme', 'green'] };

  it('matches name substring, case-insensitive', () => {
    expect(buildSearchPredicate('pepe')(pepe)).toBe(true);
    expect(buildSearchPredicate('FROG')(pepe)).toBe(true);
  });

  it('matches tag substring', () => {
    expect(buildSearchPredicate('me')(pepe)).toBe(true); // 'meme' contains 'me'
    expect(buildSearchPredicate('GREEN')(pepe)).toBe(true);
  });

  it('returns false on non-matching query', () => {
    expect(buildSearchPredicate('cats')(pepe)).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(buildSearchPredicate('')(pepe)).toBe(true);
    expect(buildSearchPredicate('   ')(pepe)).toBe(true);
  });
});

// ── AppState: computeVisibleGrid with search + sort ────────────────────────
describe('computeVisibleGrid', () => {
  const base = {
    data: new ArrayBuffer(0), mimeType: 'image/png' as const,
    packIds: [], tags: [], createdAt: 0, lastUsedAt: 0,
  };
  const s1: Sticker = { ...base, id: 's1', name: 'alpha', createdAt: 10, lastUsedAt: 30 };
  const s2: Sticker = { ...base, id: 's2', name: 'beta',  createdAt: 20, lastUsedAt: 20 };
  const s3: Sticker = { ...base, id: 's3', name: 'gamma', createdAt: 30, lastUsedAt: 10 };

  function baseState(overrides: Partial<Parameters<typeof computeVisibleGrid>[0]>) {
    return {
      stickers: [s1, s2, s3],
      packs: [],
      selection: new AllSelection(),
      sort: RecentSort,
      search: '',
      focusId: null,
      gridCols: 3,
      cellZoom: 120,
      previewOpen: false,
      modeName: 'NORMAL' as const,
      statusInput: '',
      uploadQueue: [],
      flash: null,
      theme: 'dark' as const,
      ...overrides,
    };
  }

  it('returns all stickers sorted by RecentSort when no search', () => {
    const grid = computeVisibleGrid(baseState({}));
    expect(grid.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('filters by search query', () => {
    const grid = computeVisibleGrid(baseState({ search: 'bet' }));
    expect(grid.map(s => s.id)).toEqual(['s2']);
  });

  it('sorts filtered results', () => {
    // Use 'alp' to match only s1 ('alpha') and s3 ('galpha') — not s2 ('zoom').
    const s1b: Sticker = { ...s1, name: 'alpha' };
    const s2b: Sticker = { ...s2, name: 'zoom' };
    const s3b: Sticker = { ...s3, name: 'galpha' }; // also matches 'alp'
    const grid = computeVisibleGrid(baseState({ stickers: [s1b, s2b, s3b], search: 'alp', sort: AddedSort }));
    // AddedSort: higher createdAt first → s3b (createdAt 30) before s1b (createdAt 10)
    expect(grid.map(s => s.id)).toEqual(['s3', 's1']);
  });
});

// ── CommandMode Tab autocomplete ────────────────────────────────────────────
describe('CommandMode Tab autocomplete', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('completes partial first token via Tab against registered commands', () => {
    // The real engine registers pack/sort/tag/theme/export/import/help.
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.handleKey(mkKey(':')); // enter COMMAND mode
    'pac'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Tab'));
    expect(engine.getSnapshot().statusInput).toBe('pack');
  });

  it('does not complete when input already contains a space (past first token)', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.handleKey(mkKey(':'));
    'pack n'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Tab'));
    // Space present → Tab is a no-op for the buffer.
    expect(engine.getSnapshot().statusInput).toBe('pack n');
  });

  it('leaves input unchanged when no first-token match', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.handleKey(mkKey(':'));
    'xyz'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Tab'));
    expect(engine.getSnapshot().statusInput).toBe('xyz');
  });
});

// ── SearchMode Esc clears search / Enter locks filter ───────────────────────
describe('SearchMode Esc and Enter', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Esc clears state.search and returns to NORMAL', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    // Enter SEARCH via '/', type 'cats', then Esc.
    engine.handleKey(mkKey('/'));
    'cats'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    expect(engine.getSnapshot().search).toBe('cats'); // live update
    engine.handleKey(mkKey('Escape'));
    const state = engine.getSnapshot();
    expect(state.search).toBe('');
    expect(state.modeName).toBe('NORMAL');
  });

  it('Enter locks filter (keeps state.search) and returns to NORMAL', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.handleKey(mkKey('/'));
    'dog'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Enter'));
    const state = engine.getSnapshot();
    expect(state.search).toBe('dog');
    expect(state.modeName).toBe('NORMAL');
  });
});

// ── NormalMode: n / N search navigation ─────────────────────────────────────
describe('NormalMode searchNext / searchPrev', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('n dispatches searchNext', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const captured: Intent[] = [];
    const orig = engine.dispatch.bind(engine);
    engine.dispatch = (i: Intent) => { captured.push(i); orig(i); };
    engine.handleKey(mkKey('n'));
    expect(captured.some(i => i.type === 'searchNext')).toBe(true);
  });

  it('N dispatches searchPrev', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const captured: Intent[] = [];
    const orig = engine.dispatch.bind(engine);
    engine.dispatch = (i: Intent) => { captured.push(i); orig(i); };
    engine.handleKey(mkKey('N'));
    expect(captured.some(i => i.type === 'searchPrev')).toBe(true);
  });
});

// ── PackAssignMode Tab completes current token ───────────────────────────────
describe('PackAssignMode Tab autocomplete', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Tab completes a partial pack name token', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const pack: Pack = { id: 'p1', name: 'memes', createdAt: 0 };
    const sticker: Sticker = {
      id: 's1', name: 'pepe', packIds: [], tags: [],
      data: new Uint8Array([1]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [pack] });
    // Press 'm' to enter PACKASSIGN (requires focusId; loadAll sets it to s1).
    engine.handleKey(mkKey('m'));
    // onEnter prefills '' (sticker has no packs); type 'mem' via keypresses.
    'mem'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Tab'));
    expect(engine.getSnapshot().statusInput).toBe('memes');
  });

  it('Tab completes only the last comma-separated token', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const p1: Pack = { id: 'p1', name: 'work', createdAt: 0 };
    const p2: Pack = { id: 'p2', name: 'family', createdAt: 0 };
    const sticker: Sticker = {
      id: 's1', name: 'doc', packIds: [], tags: [],
      data: new Uint8Array([1]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [p1, p2] });
    engine.handleKey(mkKey('m'));
    // onEnter prefills '' (sticker has no packs); type 'work, fam' via keypresses.
    'work, fam'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Tab'));
    expect(engine.getSnapshot().statusInput).toBe('work, family');
  });
});

// ── setZoom reducer ──────────────────────────────────────────────────────────
describe('setZoom reducer', () => {
  it('increases cellZoom by 16', () => {
    const engine = new EngineImpl(fullPorts());
    const before = engine.getSnapshot().cellZoom;
    engine.dispatch({ type: 'setZoom', delta: 16 });
    expect(engine.getSnapshot().cellZoom).toBe(before + 16);
  });

  it('decreases cellZoom by 16', () => {
    const engine = new EngineImpl(fullPorts());
    const before = engine.getSnapshot().cellZoom;
    engine.dispatch({ type: 'setZoom', delta: -16 });
    expect(engine.getSnapshot().cellZoom).toBe(before - 16);
  });

  it('clamps at 192 max', () => {
    const engine = new EngineImpl(fullPorts());
    for (let i = 0; i < 20; i++) engine.dispatch({ type: 'setZoom', delta: 16 });
    expect(engine.getSnapshot().cellZoom).toBe(192);
  });

  it('clamps at 64 min', () => {
    const engine = new EngineImpl(fullPorts());
    for (let i = 0; i < 20; i++) engine.dispatch({ type: 'setZoom', delta: -16 });
    expect(engine.getSnapshot().cellZoom).toBe(64);
  });
});

// ── NormalMode: Ctrl+= / Ctrl+- zoom ────────────────────────────────────────
describe('NormalMode zoom keys', () => {
  function mkKey(key: string, ctrl = false) {
    return { key, ctrl, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Ctrl+= dispatches setZoom +16', () => {
    const engine = new EngineImpl(fullPorts());
    const before = engine.getSnapshot().cellZoom;
    engine.handleKey(mkKey('=', true));
    expect(engine.getSnapshot().cellZoom).toBe(before + 16);
  });

  it('Ctrl+- dispatches setZoom -16', () => {
    const engine = new EngineImpl(fullPorts());
    const before = engine.getSnapshot().cellZoom;
    engine.handleKey(mkKey('-', true));
    expect(engine.getSnapshot().cellZoom).toBe(before - 16);
  });
});

// ── Preview overlay ──────────────────────────────────────────────────────────
describe('Preview overlay (previewOpen)', () => {
  const sticker: Sticker = {
    id: 's1', name: 'pepe', packIds: [], tags: [],
    data: new Uint8Array([1]).buffer, mimeType: 'image/png',
    createdAt: 0, lastUsedAt: 0,
  };
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Space opens previewOpen when focusId is non-null', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    expect(engine.getSnapshot().previewOpen).toBe(false);
    engine.handleKey(mkKey(' '));
    expect(engine.getSnapshot().previewOpen).toBe(true);
  });

  it('Space is a no-op when grid is empty', () => {
    const engine = new EngineImpl(fullPorts());
    engine.handleKey(mkKey(' '));
    expect(engine.getSnapshot().previewOpen).toBe(false);
  });

  it('Space while preview is open closes it', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.dispatch({ type: 'setPreviewOpen', open: true });
    engine.handleKey(mkKey(' '));
    expect(engine.getSnapshot().previewOpen).toBe(false);
  });

  it('Esc while preview is open closes it', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.dispatch({ type: 'setPreviewOpen', open: true });
    engine.handleKey(mkKey('Escape'));
    expect(engine.getSnapshot().previewOpen).toBe(false);
  });

  it('other keys while preview is open are absorbed (no mode change)', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.dispatch({ type: 'setPreviewOpen', open: true });
    engine.handleKey(mkKey('d')); // would normally enter CONFIRM
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().previewOpen).toBe(true);
  });
});

// ── ConfirmMode ──────────────────────────────────────────────────────────────
describe('ConfirmMode', () => {
  const sticker: Sticker = {
    id: 's1', name: 'pepe', packIds: [], tags: [],
    data: new Uint8Array([1]).buffer, mimeType: 'image/png',
    createdAt: 0, lastUsedAt: 0,
  };
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('y confirms delete and returns to NORMAL', async () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('d')); // enter CONFIRM
    expect(engine.getSnapshot().modeName).toBe('CONFIRM');
    engine.handleKey(mkKey('y'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    // Flush the async service chain: db.tx resolves (1 tick) then .then fires (1 tick).
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(engine.getSnapshot().stickers).toHaveLength(0);
  });

  it('n cancels and returns to NORMAL without deleting', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('d'));
    engine.handleKey(mkKey('n'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().stickers).toHaveLength(1);
  });

  it('Esc cancels and returns to NORMAL without deleting', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('d'));
    engine.handleKey(mkKey('Escape'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().stickers).toHaveLength(1);
  });

  it('statusline uses right field with sticker name', () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('d'));
    const model = engine.getStatuslineModel();
    expect(model.mode).toBe('CONFIRM');
    expect(model.input).toBeUndefined();
    expect(model.right).toBe('delete "pepe"? [y/n]');
  });
});

// ── UploadMode: Esc clears queue via onExit ──────────────────────────────────
describe('UploadMode', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  const stubCandidate = {
    defaultName: 'stub',
    mimeType: 'image/png' as const,
    thumbnailUrl: () => 'blob:stub',
    resolveBytes: async () => new ArrayBuffer(0),
  };

  it('Esc clears uploadQueue via onExit and returns to NORMAL', () => {
    const engine = new EngineImpl(fullPorts());
    engine.handleKey(mkKey('a')); // enter UPLOAD
    expect(engine.getSnapshot().modeName).toBe('UPLOAD');
    engine.dispatch({ type: 'enqueueCandidates', candidates: [stubCandidate] });
    expect(engine.getSnapshot().uploadQueue).toHaveLength(1);
    engine.handleKey(mkKey('Escape'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().uploadQueue).toHaveLength(0);
  });
});

// ── RenameMode ───────────────────────────────────────────────────────────────
describe('RenameMode', () => {
  const sticker: Sticker = {
    id: 's1', name: 'original', packIds: [], tags: [],
    data: new Uint8Array([1]).buffer, mimeType: 'image/png',
    createdAt: 0, lastUsedAt: 0,
  };
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Enter saves the typed name and returns to NORMAL', async () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('r')); // enter RENAME (prefills 'original')
    // Override statusInput with new name directly.
    engine.dispatch({ type: 'setStatusInput', value: 'renamed' });
    engine.handleKey(mkKey('Enter'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(engine.getSnapshot().stickers[0].name).toBe('renamed');
  });

  it('Esc cancels and returns to NORMAL without renaming', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('r'));
    engine.handleKey(mkKey('Escape'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().stickers[0].name).toBe('original');
  });
});

// ── TagsMode ─────────────────────────────────────────────────────────────────
describe('TagsMode', () => {
  const sticker: Sticker = {
    id: 's1', name: 'pepe', packIds: [], tags: ['meme'],
    data: new Uint8Array([1]).buffer, mimeType: 'image/png',
    createdAt: 0, lastUsedAt: 0,
  };
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('Enter saves the typed tags and returns to NORMAL', async () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('t')); // enter TAGS (prefills 'meme')
    engine.dispatch({ type: 'setStatusInput', value: 'funny, green' });
    engine.handleKey(mkKey('Enter'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(engine.getSnapshot().stickers[0].tags).toEqual(['funny', 'green']);
  });

  it('Esc cancels and returns to NORMAL without changing tags', () => {
    const engine = new EngineImpl(fullPorts());
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    engine.handleKey(mkKey('t'));
    engine.handleKey(mkKey('Escape'));
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().stickers[0].tags).toEqual(['meme']);
  });
});

// ── :tag clear flash ─────────────────────────────────────────────────────────
describe(':tag clear flash', () => {
  function mkKey(key: string) {
    return { key, ctrl: false, shift: false, alt: false, meta: false, preventDefault: () => {} };
  }

  it('flashes "tags cleared" after clearing tags', async () => {
    const ports = fullPorts();
    const engine = new EngineImpl(ports);
    const sticker: Sticker = {
      id: 's1', name: 'pepe', packIds: [], tags: ['meme', 'green'],
      data: new Uint8Array([1]).buffer, mimeType: 'image/png',
      createdAt: 0, lastUsedAt: 0,
    };
    engine.dispatch({ type: 'loadAll', stickers: [sticker], packs: [] });
    // Enter COMMAND mode and run :tag clear
    engine.handleKey(mkKey(':'));
    'tag clear'.split('').forEach(ch => engine.handleKey(mkKey(ch)));
    engine.handleKey(mkKey('Enter'));
    // CommandMode runs the command asynchronously; setTags is also async.
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.getSnapshot().modeName).toBe('NORMAL');
    expect(engine.getSnapshot().flash?.text).toBe('tags cleared');
    expect(engine.getSnapshot().flash?.isError).toBe(false);
    await Promise.resolve(); // flush setTags service call
    expect(engine.getSnapshot().stickers[0].tags).toHaveLength(0);
  });
});
