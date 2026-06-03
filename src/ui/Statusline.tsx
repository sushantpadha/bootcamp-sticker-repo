import type { StatuslineModel } from '../app/modes/mode';
import type { Flash } from '../app/engine/appState';
import {
  STATUS_CONTAINER_STYLE, STATUS_LABEL_STYLE, STATUS_LABEL_ERROR_STYLE,
  STATUS_INPUT_STYLE, STATUS_RIGHT_STYLE,
} from './theme/styles';

interface Props {
  model: StatuslineModel;
  flash: Flash | null;
}

// Renders the active mode's StatuslineModel with optional flash override.
// Flash overrides the LEFT label only (MODES.md decision C + STATE.md).
export function Statusline({ model, flash }: Props) {
  const leftLabel = (flash ? flash.text : model.mode).toUpperCase();
  const isError = flash?.isError ?? false;
  // `hint` and `right` are mutually exclusive across documented modes;
  // render whichever is present.
  const rightContent = model.right ?? model.hint ?? null;

  return (
    <div style={STATUS_CONTAINER_STYLE}>
      <span style={isError ? STATUS_LABEL_ERROR_STYLE : STATUS_LABEL_STYLE}>
        {leftLabel}
      </span>
      <span style={STATUS_INPUT_STYLE}>{model.input ?? ''}</span>
      {rightContent !== null && <span style={STATUS_RIGHT_STYLE}>{rightContent}</span>}
    </div>
  );
}
