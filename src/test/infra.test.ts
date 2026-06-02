// Port contract tests for real infra adapters (M9).
// Each test gets a fresh IDBFactory so stores are isolated.
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import type { Sticker } from '../domain/entities/sticker';
import type { Pack } from '../domain/entities/pack';
import { IdbDatabase } from '../infra/idb/idbDatabase';
import { IdbStickerRepository } from '../infra/idb/idbStickerRepository';
import { IdbPackRepository } from '../infra/idb/idbPackRepository';
import { JsZipCodec } from '../infra/zip/jsZipCodec';
import type { ZipManifest } from '../app/ports/zipCodecPort';

// ── test isolation ─────────────────────────────────────────────────────────────

// Replace the global indexedDB with a fresh factory before every test so each
// test sees an empty database and cannot observe writes from other tests.
beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSticker(id: string, name = id): Sticker {
  return {
    id,
    name,
    packIds: [],
    tags: [],
    data: new Uint8Array([1, 2, 3]).buffer,
    mimeType: 'image/png',
    createdAt: 0,
    lastUsedAt: 0,
  };
}

function makePack(id: string, name = id): Pack {
  return { id, name, createdAt: 0 };
}

async function freshDb() {
  const db = new IdbDatabase();
  await db.init();
  return {
    db,
    stickers: new IdbStickerRepository(),
    packs: new IdbPackRepository(),
  };
}

// ── IdbDatabase + IdbStickerRepository ────────────────────────────────────────

describe('IdbDatabase + IdbStickerRepository — port contract', () => {
  it('init() completes without error', async () => {
    const db = new IdbDatabase();
    await expect(db.init()).resolves.toBeUndefined();
  });

  it('put + getAll round-trips a Sticker including ArrayBuffer data', async () => {
    const { db, stickers } = await freshDb();
    const s = makeSticker('s1');
    await db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, s));
    const all = await db.tx(['stickers'], 'readonly', scope => stickers.getAll(scope));
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('s1');
    expect(all[0].data).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(all[0].data)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('put + get retrieves by id; missing id returns undefined', async () => {
    const { db, stickers } = await freshDb();
    const s = makeSticker('s1');
    await db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, s));
    const found   = await db.tx(['stickers'], 'readonly', scope => stickers.get(scope, 's1'));
    const missing = await db.tx(['stickers'], 'readonly', scope => stickers.get(scope, 'nope'));
    expect(found?.id).toBe('s1');
    expect(missing).toBeUndefined();
  });

  it('delete removes a sticker; subsequent get returns undefined', async () => {
    const { db, stickers } = await freshDb();
    await db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, makeSticker('s1')));
    await db.tx(['stickers'], 'readwrite', scope => stickers.delete(scope, 's1'));
    const found = await db.tx(['stickers'], 'readonly', scope => stickers.get(scope, 's1'));
    expect(found).toBeUndefined();
  });

  it('put in a readonly tx throws "Cannot write in a readonly transaction"', async () => {
    const { db, stickers } = await freshDb();
    await expect(
      db.tx(['stickers'], 'readonly', scope => stickers.put(scope, makeSticker('s1'))),
    ).rejects.toThrow('Cannot write in a readonly transaction');
  });

  it('put with Blob data throws about ArrayBuffer', async () => {
    const { db, stickers } = await freshDb();
    const bad = { ...makeSticker('s1'), data: new Blob(['x']) as unknown as ArrayBuffer };
    await expect(
      db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, bad)),
    ).rejects.toThrow('ArrayBuffer');
  });

  it('two successive tx calls see committed state from the prior tx', async () => {
    const { db, stickers } = await freshDb();
    await db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, makeSticker('s1')));
    await db.tx(['stickers'], 'readwrite', scope => stickers.put(scope, makeSticker('s2')));
    const all = await db.tx(['stickers'], 'readonly', scope => stickers.getAll(scope));
    expect(all).toHaveLength(2);
  });

  it('rollback: body that throws does not persist partial writes', async () => {
    const { db, stickers } = await freshDb();
    await expect(
      db.tx(['stickers'], 'readwrite', scope => {
        stickers.put(scope, makeSticker('s1'));
        throw new Error('oops');
      }),
    ).rejects.toThrow('oops');
    const all = await db.tx(['stickers'], 'readonly', scope => stickers.getAll(scope));
    expect(all).toHaveLength(0);
  });

  it('getAll with foreign scope throws', async () => {
    const { stickers } = await freshDb();
    // Passing a random object that is not an IdbTxScope.
    const { TxScope } = await import('../app/ports/database');
    const alien = Object.create(TxScope.prototype) as InstanceType<typeof TxScope>;
    expect(() => stickers.getAll(alien)).toThrow();
  });
});

// ── IdbDatabase + IdbPackRepository ───────────────────────────────────────────

describe('IdbDatabase + IdbPackRepository — port contract', () => {
  it('put + getAll round-trips a Pack', async () => {
    const { db, packs } = await freshDb();
    await db.tx(['packs'], 'readwrite', scope => packs.put(scope, makePack('p1', 'cats')));
    const all = await db.tx(['packs'], 'readonly', scope => packs.getAll(scope));
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('cats');
  });

  it('delete + get confirms removal', async () => {
    const { db, packs } = await freshDb();
    await db.tx(['packs'], 'readwrite', scope => packs.put(scope, makePack('p1')));
    await db.tx(['packs'], 'readwrite', scope => packs.delete(scope, 'p1'));
    const found = await db.tx(['packs'], 'readonly', scope => packs.get(scope, 'p1'));
    expect(found).toBeUndefined();
  });

  it('delete in a readonly tx throws', async () => {
    const { db, packs } = await freshDb();
    await expect(
      db.tx(['packs'], 'readonly', scope => packs.delete(scope, 'p1')),
    ).rejects.toThrow('Cannot write in a readonly transaction');
  });
});

// ── Multi-store tx ─────────────────────────────────────────────────────────────

describe('IdbDatabase — multi-store readwrite tx', () => {
  it('writes to stickers and packs in one tx', async () => {
    const { db, stickers, packs } = await freshDb();
    await db.tx(['stickers', 'packs'], 'readwrite', scope => {
      stickers.put(scope, makeSticker('s1'));
      packs.put(scope, makePack('p1'));
    });
    const s = await db.tx(['stickers'], 'readonly', scope => stickers.getAll(scope));
    const p = await db.tx(['packs'], 'readonly', scope => packs.getAll(scope));
    expect(s).toHaveLength(1);
    expect(p).toHaveLength(1);
  });
});

// ── JsZipCodec — port contract ────────────────────────────────────────────────

describe('JsZipCodec — port contract', () => {
  const codec = new JsZipCodec();

  function makeManifest(stickerId: string, filename: string): ZipManifest {
    return {
      version: 1,
      stickers: [{
        id: stickerId,
        name: 'cat',
        packIds: [],
        tags: ['cute'],
        mimeType: 'image/png',
        createdAt: 100,
        lastUsedAt: 200,
        filename,
      }],
      packs: [],
    };
  }

  it('pack → unpack round-trips manifest and file bytes', async () => {
    const filename = 'cat.png';
    const manifest = makeManifest('s1', filename);
    const files = new Map<string, ArrayBuffer>([
      [filename, new Uint8Array([9, 8, 7]).buffer],
    ]);

    const blob = await codec.pack(manifest, files);
    const { manifest: m2, files: f2 } = await codec.unpack(blob as unknown as File);

    expect(m2.stickers).toHaveLength(1);
    expect(m2.stickers[0].name).toBe('cat');
    expect(m2.stickers[0].tags).toEqual(['cute']);
    expect(f2.has(filename)).toBe(true);
    expect(new Uint8Array(f2.get(filename)!)).toEqual(new Uint8Array([9, 8, 7]));
  });

  it('unpack throws when manifest.json is missing', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('other.txt', 'hello');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(codec.unpack(blob as unknown as File)).rejects.toThrow('manifest.json');
  });

  it('unpack throws when a sticker file is absent from the zip', async () => {
    const manifest = makeManifest('s1', 'ghost.png');
    const blob = await codec.pack(manifest, new Map());
    await expect(codec.unpack(blob as unknown as File)).rejects.toThrow('ghost.png');
  });
});
