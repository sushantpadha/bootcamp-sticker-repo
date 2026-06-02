import type { StatuslineModel } from '../app/modes/mode';
import type { Flash } from '../app/engine/appState';

interface Props {
  model: StatuslineModel;
  flash: Flash | null;
}

// Renders the active mode's StatuslineModel with optional flash override.
// Layout: [left label] [input (flex)] [right or hint]
// Flash overrides the left label only; input/right always come from the mode.
// (MODES.md §Decision C, STATE.md §Flash scheduling)
export function Statusline({ model, flash }: Props) {
  const leftLabel = flash ? flash.text : model.mode;
  const isError   = flash?.isError ?? false;

  // hint and right are both right-aligned; no mode uses both simultaneously.
  const rightContent = model.right ?? model.hint ?? null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        padding: '0 8px',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Left: mode name or flash text */}
      <span
        style={{
          color: isError ? 'var(--text-error)' : 'inherit',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          paddingRight: 8,
        }}
      >
        {leftLabel}
      </span>

      {/* Input: engine-owned buffer (SEARCH / COMMAND / RENAME / TAGS / PACKASSIGN) */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {model.input ?? ''}
      </span>

      {/* Right: contextual info or confirm hint */}
      {rightContent !== null && (
        <span style={{ whiteSpace: 'nowrap', paddingLeft: 8 }}>
          {rightContent}
        </span>
      )}
    </div>
  );
}
