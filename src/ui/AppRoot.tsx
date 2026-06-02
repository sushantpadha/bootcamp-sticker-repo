import { useEffect } from 'react';
import type { EngineStore } from '../app/engine/engine';
import { useEngine } from './useEngine';
import { useObjectURLs } from './useObjectURLs';
import { KeyboardCapture } from './KeyboardCapture';
import { Grid } from './Grid';
import { Sidebar } from './Sidebar';
import { Statusline } from './Statusline';
import { HelpModal } from './overlays/HelpModal';
import './theme/themeVars.css';

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

      {/* Overlay layer — rendered on top when an exclusive mode is active */}
      {engine.getOverlayModel()?.type === 'HELP' && <HelpModal />}
    </div>
  );
}
