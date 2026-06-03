import type { CSSProperties } from 'react';

// ── Shared style fragments (ARCHITECTURE.md §Shared style patterns) ──────────
//
// Single source of truth for repeated inline styles. Change a visual aspect
// here once; every consumer updates. Colors flow from themeVars.css (CSS
// vars); this file only handles structural styling that doesn't belong in
// CSS classes (because Tailwind isn't installed for colors, and we want
// theme-var-driven everything).
//
// Categories:
//   LAYOUT_*        — viewport regions
//   SIDEBAR_*       — sidebar header + rows
//   CELL_*          — sticker grid cells
//   TOOLTIP_*       — sticker hover tooltip
//   STATUS_*        — statusline rendering
//   MODAL_*         — overlay backdrops and panels
//   DROP_*          — upload drop zone
//   INPUT_*         — text inputs (queue rows)
//   BUTTON_*        — buttons (ADD ALL, × remove)
//   HELP_*          — help modal grid
//   EMPTY_*         — empty-state messages
//
// Visual constants from SPEC + ARCHITECTURE.md §Visual constants.

// ── Sizes ────────────────────────────────────────────────────────────────────
// All pixel constants scaled ×1.25 from original spec values.
export const SIDEBAR_WIDTH_PX = 225;
export const STATUSLINE_HEIGHT_PX = 35;
export const CELL_SIZE_PX = 120;
export const THUMB_SIZE_PX = 60;
export const HOVER_SCALE = 1.15;
export const HOVER_Z = 10;
export const TOOLTIP_Z = 11;
export const STICKER_NAME_MAX = 15;
export const PACK_NAME_MAX = 18;

// ── Truncation helper ───────────────────────────────────────────────────────
export function truncate(s: string, maxChars: number): string {
  return s.length > maxChars ? s.slice(0, maxChars) + '..' : s;
}

// ── Layout ─────────────────────────────────────────────────────────────────
export const APP_ROOT_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
  background: 'var(--bg)',
  color: 'var(--text)',
};

export const TOP_REGION_STYLE: CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

export const SIDEBAR_PANEL_STYLE: CSSProperties = {
  width: SIDEBAR_WIDTH_PX,
  flexShrink: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  background: 'var(--bg-subtle)',
  borderRight: '1px solid var(--border)',
};

export const GRID_PANEL_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  background: 'var(--bg)',
  position: 'relative',
};

export const STATUSLINE_PANEL_STYLE: CSSProperties = {
  height: STATUSLINE_HEIGHT_PX,
  flexShrink: 0,
  background: 'var(--bg-subtle)',
  borderTop: '1px solid var(--border)',
};

// ── Sidebar ────────────────────────────────────────────────────────────────
export const SIDEBAR_HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 15px 5px',
  color: 'var(--text-dim)',
  fontSize: 14,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
};

export const SIDEBAR_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 15px',
  cursor: 'pointer',
  color: 'var(--text-dim)',
  userSelect: 'none',
};

export const PACK_ROW_MARKER_STYLE: CSSProperties = {
  display: 'inline-block',
  width: '1em',
  flexShrink: 0,
};

export const SIDEBAR_ROW_ACTIVE_STYLE: CSSProperties = {
  color: 'var(--text)',
  background: 'var(--highlight-bg)',
};

// ── Sticker grid + cell ────────────────────────────────────────────────────
// gridTemplateColumns is omitted — Grid.tsx computes it dynamically from cellZoom.
export const GRID_STYLE: CSSProperties = {
  display: 'grid',
  gap: 1,
  padding: 10,
  alignContent: 'start',
};

// width is not set here — StickerCell overrides it with the dynamic cellSize prop.
export const CELL_STYLE: CSSProperties = {
  cursor: 'pointer',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  userSelect: 'none',
  position: 'relative',
  transition: 'transform 80ms ease, z-index 0s linear',
};

export const CELL_FOCUSED_STYLE: CSSProperties = {
  background: 'var(--highlight-bg)',
  border: '1px solid var(--highlight-border)',
};

export const CELL_HOVER_STYLE: CSSProperties = {
  transform: `scale(${HOVER_SCALE})`,
  zIndex: HOVER_Z,
  border: '1px solid var(--border-focus)',
};

// width/height are not set here — StickerCell overrides them with the dynamic cellSize prop.
export const CELL_IMAGE_STYLE: CSSProperties = {
  objectFit: 'contain',
  display: 'block',
};

export const CELL_NAME_STYLE: CSSProperties = {
  fontSize: 14,           // overridden dynamically by StickerCell based on cellSize
  color: 'var(--text-dim)',
  padding: '3px 5px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,            // prevents flex child from overflowing parent
  boxSizing: 'border-box',
};

// ── Tooltip ────────────────────────────────────────────────────────────────
export const TOOLTIP_STYLE: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  background: 'var(--bg-subtle)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  padding: '5px 8px',
  fontSize: 14,
  whiteSpace: 'pre',
  zIndex: TOOLTIP_Z,
  pointerEvents: 'none',
  maxWidth: 300,
  overflow: 'hidden',
};

// ── Statusline ─────────────────────────────────────────────────────────────
export const STATUS_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  padding: '0 10px',
  overflow: 'hidden',
  userSelect: 'none',
};

export const STATUS_LABEL_STYLE: CSSProperties = {
  fontWeight: 600,
  whiteSpace: 'nowrap',
  paddingRight: 10,
  color: 'var(--text)',
};

export const STATUS_LABEL_ERROR_STYLE: CSSProperties = {
  ...STATUS_LABEL_STYLE,
  color: 'var(--text-error)',
};

export const STATUS_INPUT_STYLE: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const STATUS_RIGHT_STYLE: CSSProperties = {
  whiteSpace: 'nowrap',
  paddingLeft: 10,
  color: 'var(--text-dim)',
};

// ── Modal / overlay ────────────────────────────────────────────────────────
// SPEC: overlay covers the GRID only (sidebar + statusline visible).
// The modal is rendered INSIDE the grid panel container (which itself has
// position: relative). `top:0; left:0; right:0; bottom:0` fills exactly
// the grid panel — no need to know sidebar/statusline dimensions here.
export const MODAL_BACKDROP_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

export const MODAL_PANEL_STYLE: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  maxHeight: '90%',
};

export const MODAL_HEADER_STYLE: CSSProperties = {
  padding: '10px 15px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  flexShrink: 0,
};

export const MODAL_BODY_STYLE: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '10px 15px',
};

export const MODAL_FOOTER_STYLE: CSSProperties = {
  padding: '10px 15px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  flexShrink: 0,
};

// ── Drop zone ──────────────────────────────────────────────────────────────
export const DROP_ZONE_STYLE: CSSProperties = {
  margin: 10,
  border: '2px dashed var(--border)',
  padding: 20,
  textAlign: 'center',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  flexShrink: 0,
  fontSize: 15,
  letterSpacing: '0.05em',
};

export const DROP_ZONE_OVER_STYLE: CSSProperties = {
  ...DROP_ZONE_STYLE,
  border: '2px dashed var(--border-focus)',
  background: 'var(--highlight-bg)',
  color: 'var(--text)',
};

// ── Inputs ─────────────────────────────────────────────────────────────────
export const INPUT_STYLE: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 15,
  padding: '4px 8px',
  outline: 'none',
  width: '100%',
};

// ── Buttons ────────────────────────────────────────────────────────────────
export const BUTTON_PRIMARY_STYLE: CSSProperties = {
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border-focus)',
  padding: '5px 20px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 15,
  letterSpacing: '0.05em',
};

export const BUTTON_PRIMARY_DISABLED_STYLE: CSSProperties = {
  ...BUTTON_PRIMARY_STYLE,
  color: 'var(--text-dim)',
  border: '1px solid var(--border)',
  cursor: 'default',
};

export const BUTTON_REMOVE_STYLE: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-error)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 18,
  padding: '3px 8px',
  flexShrink: 0,
  lineHeight: 1,
};

// ── Help modal ─────────────────────────────────────────────────────────────
export const HELP_TWO_COL_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 30,
};

export const HELP_SECTION_HEADING_STYLE: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 14,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: 5,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 3,
};

export const HELP_KEY_CELL_STYLE: CSSProperties = {
  paddingRight: 15,
  paddingTop: 3,
  paddingBottom: 3,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
  fontWeight: 600,
};

export const HELP_DESC_CELL_STYLE: CSSProperties = {
  color: 'var(--text-dim)',
  paddingTop: 3,
  paddingBottom: 3,
  verticalAlign: 'top',
};

// ── Empty states ───────────────────────────────────────────────────────────
export const EMPTY_CENTERED_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'var(--text-dim)',
};

// ── Upload queue row ───────────────────────────────────────────────────────
export const QUEUE_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 13,
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
};

export const QUEUE_THUMB_STYLE: CSSProperties = {
  width: THUMB_SIZE_PX,
  height: THUMB_SIZE_PX,
  objectFit: 'contain',
  flexShrink: 0,
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
};
