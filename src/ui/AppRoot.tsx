import { useEffect } from 'react';
import type { EngineStore } from '../app/engine/engine';
import { useEngine } from './useEngine';
import { useObjectURLs } from './useObjectURLs';
import { KeyboardCapture } from './KeyboardCapture';
import { Grid } from './Grid';
import { Sidebar } from './Sidebar';
import { Statusline } from './Statusline';
import { HelpModal } from './overlays/HelpModal';
import { UploadModal } from './overlays/UploadModal';
import { PreviewModal } from './overlays/PreviewModal';
import {
  APP_ROOT_STYLE, TOP_REGION_STYLE, SIDEBAR_PANEL_STYLE, GRID_PANEL_STYLE,
  STATUSLINE_PANEL_STYLE,
} from './theme/styles';
import './theme/themeVars.css';

interface Props { engine: EngineStore; }

export function AppRoot({ engine }: Props) {
  const { snapshot, dispatch } = useEngine(engine);
  const objectURLs = useObjectURLs(snapshot.stickers);

  // Mirror theme onto <html> class.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-light');
    html.classList.add(`theme-${snapshot.theme}`);
  }, [snapshot.theme]);

  const overlay = engine.getOverlayModel();

  return (
    <div style={APP_ROOT_STYLE}>
      <div style={TOP_REGION_STYLE}>
        <div style={SIDEBAR_PANEL_STYLE}>
          <Sidebar snapshot={snapshot} dispatch={dispatch} />
        </div>
        <div style={GRID_PANEL_STYLE}>
          <Grid snapshot={snapshot} objectURLs={objectURLs} dispatch={dispatch} />
          {overlay?.type === 'HELP' && <HelpModal />}
          {overlay?.type === 'UPLOAD' && (
            <UploadModal snapshot={snapshot} dispatch={dispatch} />
          )}
          {snapshot.previewOpen && (
            <PreviewModal snapshot={snapshot} objectURLs={objectURLs} dispatch={dispatch} />
          )}
        </div>
      </div>

      <div style={STATUSLINE_PANEL_STYLE}>
        <Statusline model={engine.getStatuslineModel()} flash={snapshot.flash} />
      </div>

      <KeyboardCapture engine={engine} snapshot={snapshot} />
    </div>
  );
}
