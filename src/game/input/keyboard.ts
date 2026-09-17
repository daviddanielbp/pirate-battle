import { KEY_BINDINGS, type ControlAction, type ControlState } from './controls';

export interface KeyboardOptions {
  target: Window;
  state: ControlState;
  isActive: () => boolean;
  onPause: () => void;
  ignoreTurns?: boolean;
}

const TURN_ACTIONS: ReadonlySet<ControlAction> = new Set(['turnLeft', 'turnRight']);

export function attachKeyboard(options: KeyboardOptions): () => void {
  const { target, state, isActive, onPause } = options;
  const ignoreTurns = options.ignoreTurns ?? false;

  const onKeyDown = (event: KeyboardEvent): void => {
    const action: ControlAction | undefined = KEY_BINDINGS[event.code];
    if (!action) return;
    if (!isActive()) return;
    event.preventDefault();
    if (event.repeat) return;
    if (action === 'pause') {
      onPause();
      return;
    }
    if (ignoreTurns && TURN_ACTIONS.has(action)) return;
    state.press(action);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_BINDINGS[event.code];
    if (!action || action === 'pause') return;
    state.release(action);
  };

  const onBlur = (): void => state.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
    state.clear();
  };
}
