import type { ControlState } from './controls';

export interface PointerSteeringOptions {
  surface: HTMLElement;
  state: ControlState;
  isActive: () => boolean;
  toArenaPoint: (clientX: number, clientY: number) => { x: number; y: number } | null;
  playerPosition: () => { x: number; y: number };
}

export function attachPointerSteering(options: PointerSteeringOptions): () => void {
  const { surface, state, isActive, toArenaPoint, playerPosition } = options;
  let lastClient: { x: number; y: number } | null = null;

  const aim = (): void => {
    if (!lastClient || !isActive()) return;
    const point = toArenaPoint(lastClient.x, lastClient.y);
    if (!point) return;
    const player = playerPosition();
    state.setTargetHeading(Math.atan2(point.y - player.y, point.x - player.x));
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    lastClient = { x: event.clientX, y: event.clientY };
    aim();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.button !== 0 || !isActive()) return;
    if (event.target !== surface && !(event.target instanceof HTMLCanvasElement)) return;
    event.preventDefault();
    lastClient = { x: event.clientX, y: event.clientY };
    aim();
    state.press('fireFront');
  };

  const onPointerUp = (): void => {
    state.release('fireFront');
  };

  const onLeave = (): void => {
    state.release('fireFront');
  };

  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  let frame = 0;
  const track = (): void => {
    aim();
    frame = window.requestAnimationFrame(track);
  };
  frame = window.requestAnimationFrame(track);

  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  surface.addEventListener('pointerleave', onLeave);
  surface.addEventListener('contextmenu', onContextMenu);
  return () => {
    surface.removeEventListener('contextmenu', onContextMenu);
    window.cancelAnimationFrame(frame);
    surface.removeEventListener('pointermove', onPointerMove);
    surface.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    surface.removeEventListener('pointerleave', onLeave);
    state.setTargetHeading(null);
  };
}
