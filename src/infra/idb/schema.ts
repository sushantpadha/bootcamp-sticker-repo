export const DB_NAME = 'stickerdb';
export const DB_VERSION = 1;

export function applySchema(db: IDBDatabase): void {
  const stickerStore = db.createObjectStore('stickers', { keyPath: 'id' });
  stickerStore.createIndex('lastUsedAt', 'lastUsedAt', { unique: false });
  stickerStore.createIndex('createdAt', 'createdAt', { unique: false });
  stickerStore.createIndex('packIds', 'packIds', { unique: false, multiEntry: true });

  db.createObjectStore('packs', { keyPath: 'id' });
}
