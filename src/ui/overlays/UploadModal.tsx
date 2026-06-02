import { useRef, useEffect, useCallback } from 'react';
import type { AppState, QueuedSticker } from '../../app/engine/appState';
import type { Intent } from '../../app/engine/intents';
import type { StickerCandidate } from '../../domain/values/stickerCandidate';
import type { SupportedMime } from '../../domain/values/mime';

// ── UploadModal ────────────────────────────────────────────────────────────────
//
// Upload overlay rendered when UPLOAD mode is active (M15).
//
// IMPORTANT: Escape/Enter are NOT handled here. UploadMode.handleKey owns those
// transitions (MODES.md §Decision B). This component only handles file drops,
// clipboard paste, and queue row edits.
//
// This component is responsible for revoking thumbnail object URLs on unmount
// (UploadMode delegates this to the UI layer because URL.revokeObjectURL is a
// browser global that must not be called from app/** — see UploadMode comments).

interface Props {
  snapshot: AppState;
  dispatch: (intent: Intent) => void;
}

// ── Inline StickerCandidate implementations ────────────────────────────────────
// These live in the UI layer because they are created in response to UI events
// (drag-drop, file picker, clipboard paste). URL.createObjectURL / File /
// FileReader are not in the restricted-globals list (indexedDB / navigator /
// localStorage / crypto), so ui/** may use them.

const SUPPORTED_MIME: SupportedMime[] = ['image/png', 'image/gif', 'image/webp'];

function isSupportedMime(type: string): type is SupportedMime {
  return (SUPPORTED_MIME as string[]).includes(type);
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename;
}

class FileStickerCandidate implements StickerCandidate {
  readonly defaultName: string;
  readonly mimeType: SupportedMime;
  private readonly file: File;
  private objectUrl: string | null = null;

  constructor(file: File) {
    this.file = file;
    this.mimeType = file.type as SupportedMime;
    this.defaultName = stripExtension(file.name);
  }

  thumbnailUrl(): string {
    if (!this.objectUrl) this.objectUrl = URL.createObjectURL(this.file);
    return this.objectUrl;
  }

  async resolveBytes(): Promise<ArrayBuffer> {
    return this.file.arrayBuffer();
  }
}

class ClipboardStickerCandidate implements StickerCandidate {
  readonly defaultName: string;
  readonly mimeType: SupportedMime;
  private readonly blob: Blob;
  private objectUrl: string | null = null;

  constructor(blob: Blob, index: number) {
    this.blob = blob;
    this.mimeType = blob.type as SupportedMime;
    this.defaultName = `clipboard-${index + 1}`;
  }

  thumbnailUrl(): string {
    if (!this.objectUrl) this.objectUrl = URL.createObjectURL(this.blob);
    return this.objectUrl;
  }

  async resolveBytes(): Promise<ArrayBuffer> {
    return this.blob.arrayBuffer();
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UploadModal({ snapshot, dispatch }: Props) {
  const { uploadQueue, packs } = snapshot;

  // Track object URLs created by candidates so we can revoke them on unmount.
  // We call thumbnailUrl() once per row to snapshot the URL into this map.
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    // Snapshot thumbnail URLs for any new rows so we can revoke them later.
    uploadQueue.forEach((row, idx) => {
      if (urlsRef.current[idx] === undefined) {
        urlsRef.current[idx] = row.candidate.thumbnailUrl();
      }
    });
    // Trim revoked rows that were removed from the queue.
    if (urlsRef.current.length > uploadQueue.length) {
      const removed = urlsRef.current.splice(uploadQueue.length);
      removed.forEach(url => URL.revokeObjectURL(url));
    }
  }, [uploadQueue]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach(url => URL.revokeObjectURL(url));
      urlsRef.current = [];
    };
  }, []);

  const enqueueFiles = useCallback((files: Iterable<File>) => {
    const valid = Array.from(files).filter(f => isSupportedMime(f.type));
    if (valid.length === 0) return;
    const candidates = valid.map(f => new FileStickerCandidate(f));
    dispatch({ type: 'enqueueCandidates', candidates });
  }, [dispatch]);

  // ── Drop zone ────────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) enqueueFiles(e.dataTransfer.files);
  };

  const handleClickDropZone = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/gif,image/webp';
    input.multiple = true;
    input.onchange = () => { if (input.files) enqueueFiles(input.files); };
    input.click();
  };

  // ── Ctrl+V paste ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items)
        .filter(item => isSupportedMime(item.type));
      if (items.length === 0) return;
      e.preventDefault();
      const blobs = items
        .map(item => item.getAsFile())
        .filter((b): b is File => b !== null && isSupportedMime(b.type));
      if (blobs.length === 0) return;
      const startIdx = uploadQueue.length;
      const candidates = blobs.map((blob, i) => new ClipboardStickerCandidate(blob, startIdx + i));
      dispatch({ type: 'enqueueCandidates', candidates });
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [dispatch, uploadQueue.length]);

  // ── ADD ALL ───────────────────────────────────────────────────────────────────

  const handleAddAll = () => {
    dispatch({ type: 'saveUpload' });
  };

  const packNames = packs.map(p => p.name);

  return (
    <div
      style={{
        position: 'absolute',
        // Overlay the grid area only: sidebar is 180 px wide, statusline 28 px tall.
        top: 0,
        left: 180,
        right: 0,
        bottom: 28,
        background: 'var(--bg-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'var(--bg-overlay-panel)',
          border: '1px solid var(--border)',
          width: 640,
          maxWidth: '95%',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            color: 'var(--mode-upload)',
            fontWeight: 600,
            fontSize: '0.85em',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          UPLOAD — {uploadQueue.length} queued · Enter to save · Esc to cancel
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClickDropZone}
          style={{
            margin: '12px 16px',
            border: '2px dashed var(--border-focus)',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            flexShrink: 0,
            fontSize: '0.85em',
            letterSpacing: '0.05em',
          }}
        >
          DROP STICKERS HERE
          <div style={{ marginTop: 4, fontSize: '0.8em', color: 'var(--text-hint)' }}>
            PNG / GIF / WebP / APNG · click to open picker · Ctrl+V to paste
          </div>
        </div>

        {/* Queue rows */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 16px 8px',
          }}
        >
          {uploadQueue.length === 0 && (
            <div
              style={{
                color: 'var(--text-hint)',
                fontSize: '0.8em',
                textAlign: 'center',
                padding: '12px 0',
              }}
            >
              No stickers queued yet
            </div>
          )}
          {uploadQueue.map((row, idx) => (
            <QueueRow
              key={idx}
              index={idx}
              row={row}
              thumbnailUrl={urlsRef.current[idx] ?? row.candidate.thumbnailUrl()}
              packSuggestions={packNames}
              dispatch={dispatch}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleAddAll}
            disabled={uploadQueue.length === 0}
            style={{
              background: uploadQueue.length > 0 ? 'var(--mode-upload)' : 'var(--bg-input)',
              color: uploadQueue.length > 0 ? '#000' : 'var(--text-dim)',
              border: '1px solid var(--border)',
              padding: '4px 16px',
              cursor: uploadQueue.length > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
              fontSize: '0.85em',
              letterSpacing: '0.05em',
            }}
          >
            ADD ALL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QueueRow ───────────────────────────────────────────────────────────────────

interface QueueRowProps {
  index: number;
  row: QueuedSticker;
  thumbnailUrl: string;
  packSuggestions: string[];
  dispatch: (intent: Intent) => void;
}

function QueueRow({ index, row, thumbnailUrl, packSuggestions, dispatch }: QueueRowProps) {
  const patchRow = (patch: Partial<Pick<QueuedSticker, 'name' | 'tags' | 'packNames'>>) => {
    dispatch({ type: 'editQueueRow', index, patch });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    patchRow({ name: e.target.value });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
    patchRow({ tags });
  };

  const handlePacksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const packNames = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
    patchRow({ packNames });
  };

  const handlePacksKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    e.stopPropagation();
    const val = (e.target as HTMLInputElement).value;
    const tokens = val.split(',').map(t => t.trim());
    const lastToken = tokens[tokens.length - 1] ?? '';
    const match = packSuggestions.find(p =>
      p.toLowerCase().startsWith(lastToken.toLowerCase()) && p !== lastToken,
    );
    if (match) {
      tokens[tokens.length - 1] = match;
      (e.target as HTMLInputElement).value = tokens.join(', ');
      patchRow({ packNames: tokens.filter(Boolean) });
    }
  };

  const handleRemove = () => dispatch({ type: 'removeQueueRow', index });

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.85em',
    padding: '3px 6px',
    outline: 'none',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--text-dim)',
    fontSize: '0.75em',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* 48×48 thumbnail */}
      <img
        src={thumbnailUrl}
        alt={row.name}
        style={{
          width: 48,
          height: 48,
          objectFit: 'contain',
          flexShrink: 0,
          background: 'var(--bg-cell)',
          border: '1px solid var(--border)',
        }}
      />

      {/* Editable fields */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div>
          <div style={labelStyle}>Name</div>
          <input
            style={inputStyle}
            defaultValue={row.name}
            onChange={handleNameChange}
            onKeyDown={e => e.stopPropagation()}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Tags (comma-separated)</div>
            <input
              style={inputStyle}
              defaultValue={row.tags.join(', ')}
              onChange={handleTagsChange}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Pack (Tab to complete)</div>
            <input
              style={inputStyle}
              defaultValue={row.packNames.join(', ')}
              onChange={handlePacksChange}
              onKeyDown={handlePacksKeyDown}
            />
          </div>
        </div>
      </div>

      {/* × remove */}
      <button
        onClick={handleRemove}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-error)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '1.1em',
          padding: '2px 4px',
          flexShrink: 0,
          lineHeight: 1,
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}
