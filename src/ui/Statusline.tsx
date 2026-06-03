import { useEffect, useRef, useState } from 'react';
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

  // Blink animation fires once each time mode transitions TO 'CONFIRM'.
  const [blinking, setBlinking] = useState(false);
  const prevModeRef = useRef(model.mode);
  useEffect(() => {
    if (model.mode === 'CONFIRM' && prevModeRef.current !== 'CONFIRM') {
      setBlinking(true);
    }
    prevModeRef.current = model.mode;
  }, [model.mode]);

  return (
    <div
      style={STATUS_CONTAINER_STYLE}
      className={blinking ? 'statusline-blink' : undefined}
      onAnimationEnd={() => setBlinking(false)}
    >
      <span style={isError ? STATUS_LABEL_ERROR_STYLE : STATUS_LABEL_STYLE}>
        {leftLabel}
      </span>
      <span style={STATUS_INPUT_STYLE}>{model.input ?? ''}</span>
      {rightContent !== null && <span style={STATUS_RIGHT_STYLE}>{rightContent}</span>}
    </div>
  );
}
