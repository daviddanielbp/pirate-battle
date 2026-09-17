import type { ShipCommand } from '../core/entities';

export type ControlAction = 'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight' | 'pause';

export const KEY_BINDINGS: Readonly<Record<string, ControlAction>> = Object.freeze({
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'fireFront',
  KeyQ: 'fireLeft',
  KeyE: 'fireRight',
  Escape: 'pause',
  KeyP: 'pause',
});

export const CONTROL_GUIDE: readonly { action: string; keys: string; touch: string }[] = [
  { action: 'Sail forward', keys: 'W or ↑', touch: 'Forward button' },
  { action: 'Turn left / right', keys: 'A / D or ← / →', touch: 'Turn buttons' },
  { action: 'Fire front cannon', keys: 'Space', touch: 'Front fire button' },
  { action: 'Port broadside (left)', keys: 'Q', touch: 'Left fire button' },
  { action: 'Starboard broadside (right)', keys: 'E', touch: 'Right fire button' },
  { action: 'Pause', keys: 'Esc or P', touch: 'Pause button' },
];

export class ControlState {
  private readonly held = new Set<ControlAction>();
  private readonly tapped = new Set<ControlAction>();
  private targetHeading: number | null = null;

  setTargetHeading(heading: number | null): void {
    this.targetHeading = heading;
  }

  press(action: ControlAction): void {
    this.held.add(action);
    this.tapped.add(action);
  }

  release(action: ControlAction): void {
    this.held.delete(action);
  }

  clear(): void {
    this.held.clear();
    this.tapped.clear();
    this.targetHeading = null;
  }

  isHeld(action: ControlAction): boolean {
    return this.held.has(action);
  }

  toCommand(): ShipCommand {
    const active = (action: ControlAction): boolean => this.held.has(action) || this.tapped.has(action);
    const left = active('turnLeft');
    const right = active('turnRight');
    const command: ShipCommand = {
      forward: active('forward'),
      turn: left === right ? 0 : left ? -1 : 1,
      targetHeading: this.targetHeading,
      fireFront: active('fireFront'),
      fireLeft: active('fireLeft'),
      fireRight: active('fireRight'),
    };
    this.tapped.clear();
    return command;
  }
}
