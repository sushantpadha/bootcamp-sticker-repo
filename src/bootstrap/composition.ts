// ── Composition root (ARCHITECTURE.md §Composition root contract) ────────────
//
// This is the ONLY module that constructs infra adapters or reads browser
// globals (indexedDB, navigator, localStorage, crypto). Swapping real infra
// for M3 fakes is a one-line change per adapter below.

import { IdbDatabase } from '../infra/idb/idbDatabase';
import { IdbStickerRepository } from '../infra/idb/idbStickerRepository';
import { IdbPackRepository } from '../infra/idb/idbPackRepository';
import { NavigatorClipboard } from '../infra/clipboard/navigatorClipboard';
import { JsZipCodec } from '../infra/zip/jsZipCodec';
import { LocalStorageKeyValueStore } from '../infra/kv/localStorageKeyValueStore';
import { SystemClock } from '../infra/system/systemClock';
import { CryptoIdGenerator } from '../infra/system/cryptoIdGenerator';
import { EngineImpl } from '../app/engine/engine';

// Download fallback: triggered by YankService when navigator.clipboard.write
// is unavailable (non-HTTPS or denied permission).
function downloadFallback(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Defer revocation so the browser's download manager can fetch the blob URL
  // before it is invalidated (synchronous revoke races the async fetch).
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── Adapter instantiation ─────────────────────────────────────────────────────
// To swap for fakes (e.g. for testing or M10 substitutability check), replace
// each `new Idb*` / `new Navigator*` with the corresponding `new Fake*`.

const db        = new IdbDatabase();
const stickers  = new IdbStickerRepository();
const packs     = new IdbPackRepository();
const kv        = new LocalStorageKeyValueStore();
const clipboard = new NavigatorClipboard();
const zip       = new JsZipCodec();
const idGen     = new CryptoIdGenerator();
const clock     = new SystemClock();

export const engine = new EngineImpl({
  kv,
  db,
  stickers,
  packs,
  clipboard,
  idGen,
  clock,
  zip,
  onDownloadFallback: downloadFallback,
});

// Opens the IDB, reads all persisted data, and dispatches loadAll so the UI
// populates from the stored state. Called once from main.tsx at startup.
export async function initAsync(): Promise<void> {
  await db.init();
  const { s, p } = await db.tx(['stickers', 'packs'], 'readonly', scope => ({
    s: stickers.getAll(scope),
    p: packs.getAll(scope),
  }));
  engine.dispatch({ type: 'loadAll', stickers: s, packs: p });
}
