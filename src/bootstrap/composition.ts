// ── Composition root (ARCHITECTURE.md §Composition root contract) ───────────
//
// The ONLY module that constructs infra adapters or reads browser globals.
// Swapping in fakes for any port is a one-line change at the corresponding
// `const x = useFakes ? new Fake* : new Idb*` (or per-port equivalent).

import type { Database } from '../app/ports/database';
import type { StickerRepository, PackRepository } from '../app/ports/database';
import type { ClipboardPort } from '../app/ports/clipboardPort';
import type { FilePickerPort } from '../app/ports/filePickerPort';
import type { ZipCodecPort } from '../app/ports/zipCodecPort';
import type { KeyValueStore } from '../app/ports/keyValueStore';
import type { Clock } from '../app/ports/clock';
import type { IdGenerator } from '../app/ports/idGenerator';
import type { Timer } from '../app/ports/timer';

import { IdbDatabase } from '../infra/idb/idbDatabase';
import { IdbStickerRepository } from '../infra/idb/idbStickerRepository';
import { IdbPackRepository } from '../infra/idb/idbPackRepository';
import { NavigatorClipboard } from '../infra/clipboard/navigatorClipboard';
import { DomFilePicker } from '../infra/files/domFilePicker';
import { JsZipCodec } from '../infra/zip/jsZipCodec';
import { LocalStorageKeyValueStore } from '../infra/kv/localStorageKeyValueStore';
import { SystemClock } from '../infra/system/systemClock';
import { CryptoIdGenerator } from '../infra/system/cryptoIdGenerator';
import { SystemTimer } from '../infra/system/systemTimer';

import { EngineImpl } from '../app/engine/engine';

// ── Download helper (yank fallback + :export trigger) ─────────────────────
// Uses object-URL + <a download> + click + revoke. Defers revoke so the
// browser's download manager can fetch the blob URL.
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Adapter wiring ────────────────────────────────────────────────────────
// To swap a port for its fake, flip ONE line.
const db:          Database          = new IdbDatabase();
const stickers:    StickerRepository = new IdbStickerRepository();
const packs:       PackRepository    = new IdbPackRepository();
const kv:          KeyValueStore     = new LocalStorageKeyValueStore();
const clipboard:   ClipboardPort     = new NavigatorClipboard();
const zip:         ZipCodecPort      = new JsZipCodec();
const filePicker:  FilePickerPort    = new DomFilePicker();
const idGen:       IdGenerator       = new CryptoIdGenerator();
const clock:       Clock             = new SystemClock();
const timer:       Timer             = new SystemTimer();

export const engine = new EngineImpl({
  kv, timer, db, stickers, packs, clipboard, idGen, clock, zip, filePicker,
  downloadBlob,
});

// Read persisted state and dispatch loadAll.
export async function initAsync(): Promise<void> {
  void navigator.storage?.persist?.();
  await db.init();
  const { s, p } = await db.tx(['stickers', 'packs'], 'readonly', scope => ({
    s: stickers.getAll(scope),
    p: packs.getAll(scope),
  }));
  engine.dispatch({ type: 'loadAll', stickers: s, packs: p });
}
