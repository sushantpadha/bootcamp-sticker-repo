import { useEffect, useState, useCallback } from 'react';
import type { AppState } from '../../app/engine/appState';
import type { QueuedSticker } from '../../app/upload/uploadQueue';
import type { Intent } from '../../app/engine/intents';
import { FileStickerCandidate } from '../../app/upload/fileCandidate';
import { ClipboardStickerCandidate } from '../../app/upload/clipboardCandidate';
import { isAcceptedUploadMime, UPLOAD_ACCEPT } from '../../app/upload/mimeCoercion';
import { completeToken } from '../../domain/naming/completeToken';
import {
  MODAL_BACKDROP_STYLE, MODAL_PANEL_STYLE, MODAL_HEADER_STYLE,
  MODAL_BODY_STYLE, MODAL_FOOTER_STYLE,
  DROP_ZONE_STYLE, DROP_ZONE_OVER_STYLE, INPUT_STYLE,
  BUTTON_PRIMARY_STYLE, BUTTON_PRIMARY_DISABLED_STYLE, BUTTON_REMOVE_STYLE,
  QUEUE_ROW_STYLE, QUEUE_THUMB_STYLE,
} from '../theme/styles';

interface Props {
  snapshot: AppState;
  dispatch: (intent: Intent) => void;
}

// UPLOAD mode overlay (M15 / SPEC §Upload Modal).
// Escape/Enter handled by UploadMode.handleKey; this component handles drops,
// Ctrl+V paste, queue row edits, and the ADD ALL button.
export function UploadModal({ snapshot, dispatch }: Props) {
  const { uploadQueue, packs } = snapshot;
  const [dragOver, setDragOver] = useState(false);

  // Track thumbnail URLs so we can revoke them on unmount. Candidates are
  // app/upload classes; their thumbnailUrl() lazily creates URL on first
  // call. We snapshot per row index so we revoke the right URLs.
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(prev => {
      const next = [...prev];
      uploadQueue.forEach((row, i) => {
        if (next[i] === undefined) next[i] = row.candidate.thumbnailUrl();
      });
      // Revoke any URLs for rows that no longer exist.
      if (next.length > uploadQueue.length) {
        for (let i = uploadQueue.length; i < next.length; i++) {
          URL.revokeObjectURL(next[i]);
        }
        next.length = uploadQueue.length;
      }
      return next;
    });
  }, [uploadQueue]);

  useEffect(() => {
    return () => {
      urls.forEach(URL.revokeObjectURL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enqueueFiles = useCallback((files: Iterable<File>) => {
    const valid = Array.from(files).filter(f => isAcceptedUploadMime(f.type));
    if (valid.length === 0) return;
    const candidates = valid.map(f => new FileStickerCandidate(f));
    dispatch({ type: 'enqueueCandidates', candidates });
  }, [dispatch]);

  // ── Drop zone ────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) enqueueFiles(e.dataTransfer.files);
  };

  const handleClickDropZone = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = UPLOAD_ACCEPT;
    input.multiple = true;
    input.onchange = () => { if (input.files) enqueueFiles(input.files); };
    input.click();
  };

  // ── Ctrl+V paste ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items)
        .filter(item => isAcceptedUploadMime(item.type));
      if (items.length === 0) return;
      e.preventDefault();
      const blobs = items
        .map(item => item.getAsFile())
        .filter((b): b is File => b !== null && isAcceptedUploadMime(b.type));
      if (blobs.length === 0) return;
      const startIdx = uploadQueue.length;
      const candidates = blobs.map((blob, i) => new ClipboardStickerCandidate(blob, startIdx + i));
      dispatch({ type: 'enqueueCandidates', candidates });
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [dispatch, uploadQueue.length]);

  const handleAddAll = () => dispatch({ type: 'saveUpload' });
  const packNames = packs.map(p => p.name);

  return (
    <div style={MODAL_BACKDROP_STYLE}>
      <div style={{ ...MODAL_PANEL_STYLE, width: 640, maxWidth: '95%' }}>
        <div style={MODAL_HEADER_STYLE}>
          UPLOAD — {uploadQueue.length} queued · Enter to save · Esc to cancel
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickDropZone}
          style={dragOver ? DROP_ZONE_OVER_STYLE : DROP_ZONE_STYLE}
        >
          DROP STICKERS HERE
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            PNG / GIF / WebP / APNG · click to pick · Ctrl+V to paste
          </div>
        </div>

        <div style={MODAL_BODY_STYLE}>
          {uploadQueue.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
              no stickers queued yet
            </div>
          )}
          {uploadQueue.map((row, idx) => (
            <QueueRow
              key={idx}
              index={idx}
              row={row}
              thumbnailUrl={urls[idx] ?? row.candidate.thumbnailUrl()}
              packSuggestions={packNames}
              dispatch={dispatch}
            />
          ))}
        </div>

        <div style={MODAL_FOOTER_STYLE}>
          <button
            onClick={handleAddAll}
            disabled={uploadQueue.length === 0}
            style={uploadQueue.length > 0 ? BUTTON_PRIMARY_STYLE : BUTTON_PRIMARY_DISABLED_STYLE}
          >
            ADD ALL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QueueRow ───────────────────────────────────────────────────────────────
interface QueueRowProps {
  index: number;
  row: QueuedSticker;
  thumbnailUrl: string;
  packSuggestions: string[];
  dispatch: (intent: Intent) => void;
}

function QueueRow({ index, row, thumbnailUrl, packSuggestions, dispatch }: QueueRowProps) {
  const patchRow = (patch: Partial<Pick<QueuedSticker, 'name' | 'tags' | 'packNames'>>) =>
    dispatch({ type: 'editQueueRow', index, patch });

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
    const target = e.target as HTMLInputElement;
    const next = completeToken(target.value, packSuggestions);
    target.value = next;
    const packNames = next.split(',').map(t => t.trim()).filter(Boolean);
    patchRow({ packNames });
  };
  const handleRemove = () => dispatch({ type: 'removeQueueRow', index });

  return (
    <div style={QUEUE_ROW_STYLE}>
      <img src={thumbnailUrl} alt={row.name} style={QUEUE_THUMB_STYLE} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          style={INPUT_STYLE}
          defaultValue={row.name}
          placeholder="name..."
          onChange={handleNameChange}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={INPUT_STYLE}
            defaultValue={row.tags.join(', ')}
            placeholder="tags..."
            onChange={handleTagsChange}
          />
          <input
            style={INPUT_STYLE}
            defaultValue={row.packNames.join(', ')}
            placeholder="packs..."
            onChange={handlePacksChange}
            onKeyDown={handlePacksKeyDown}
          />
        </div>
      </div>
      <button onClick={handleRemove} style={BUTTON_REMOVE_STYLE} title="Remove">×</button>
    </div>
  );
}
