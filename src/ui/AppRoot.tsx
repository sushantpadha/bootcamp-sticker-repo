import { useEffect, useRef } from 'react';
import type { EngineStore } from '../app/engine/engine';
import type { Sticker } from '../domain/entities/sticker';
import { useEngine } from './useEngine';
import { KeyboardCapture } from './KeyboardCapture';
import { Grid } from './Grid';
import { Sidebar } from './Sidebar';
import { Statusline } from './Statusline';
import './theme/themeVars.css';

// ── Object URL memoization ────────────────────────────────────────────────────
//
// Sticker.data is an ArrayBuffer. createObjectURL is expensive and must not be
// called on every render. This hook caches URLs keyed by sticker id and only
// creates/revokes when the ArrayBuffer reference itself changes.
// All URLs are revoked on unmount.

interface CachedURL {
  url: string;
  buffer: ArrayBuffer;
}

export function useObjectURLs(stickers: Sticker[]): ReadonlyMap<string, string> {
  const cacheRef = useRef<Map<string, CachedURL>>(new Map());
  const cache = cacheRef.current;

  // Synchronous ref mutation: safe because refs are not React state and this
  // doesn't trigger a re-render. Runs during render so the returned map is
  // immediately current (not deferred by a useEffect cycle).
  const nextIds = new Set(stickers.map(s => s.id));

  for (const [id, { url }] of cache) {
    if (!nextIds.has(id)) {
      URL.revokeObjectURL(url);
      cache.delete(id);
    }
  }

  for (const sticker of stickers) {
    const existing = cache.get(sticker.id);
    if (!existing || existing.buffer !== sticker.data) {
      if (existing) URL.revokeObjectURL(existing.url);
      const url = URL.createObjectURL(
        new Blob([sticker.data], { type: sticker.mimeType }),
      );
      cache.set(sticker.id, { url, buffer: sticker.data });
    }
  }

  // Revoke everything on unmount.
  useEffect(() => () => {
    for (const { url } of cacheRef.current.values()) URL.revokeObjectURL(url);
    cacheRef.current.clear();
  }, []);

  return cache;
}

// ── AppRoot ───────────────────────────────────────────────────────────────────
//
// Three-region layout (M12):
//   ┌──────────────────────────────────┐
//   │ sidebar 180px │ grid (flex: 1)   │  flex: 1, overflow: hidden
//   ├──────────────────────────────────┤
//   │ statusline 28px                  │  flex-shrink: 0
//   └──────────────────────────────────┘
//
// Full viewport height, no page scroll.  Each region scrolls internally with
// hidden scrollbar tracks (styled in themeVars.css).

interface Props {
  engine: EngineStore;
}

export function AppRoot({ engine }: Props) {
  const { snapshot, dispatch } = useEngine(engine);

  // Expose objectURLs to child components (Grid in M13) so they receive
  // pre-created URLs rather than calling createObjectURL themselves.
  const objectURLs = useObjectURLs(snapshot.stickers);

  // Theme wiring: mirror AppState.theme onto <html> as a CSS class so the
  // custom-property sets in themeVars.css take effect globally.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-light');
    html.classList.add(`theme-${snapshot.theme}`);
  }, [snapshot.theme]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* Top region: sidebar + grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — 180 px wide, internally scrollable */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <Sidebar snapshot={snapshot} dispatch={dispatch} />
        </div>

        {/* Grid — remaining width, internally scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-grid)',
          }}
        >
          <Grid snapshot={snapshot} objectURLs={objectURLs} dispatch={dispatch} />
        </div>
      </div>

      {/* Statusline — 28 px tall, never scrolls */}
      <div
        style={{
          height: 28,
          flexShrink: 0,
          background: 'var(--bg-statusline)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Statusline model={engine.getStatuslineModel()} flash={snapshot.flash} />
      </div>

      <KeyboardCapture engine={engine} snapshot={snapshot} />
    </div>
  );
}
