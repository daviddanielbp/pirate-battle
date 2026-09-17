import { clamp } from './math';

export const CELL_SIZE = 64;
export const ARENA_COLUMNS = 29;
export const ARENA_ROWS = 16;
export const ARENA_WIDTH = ARENA_COLUMNS * CELL_SIZE;
export const ARENA_HEIGHT = ARENA_ROWS * CELL_SIZE;

export type IslandStyle = 'sand' | 'grass';

export interface PropPlacement {
  tile: number;
  col: number;
  row: number;
}

export interface IslandDefinition {
  col: number;
  row: number;
  cols: number;
  rows: number;
  style: IslandStyle;
  props?: PropPlacement[];
}

export interface ArenaDefinition {
  id: string;
  name: string;
  islands: IslandDefinition[];
  playerStart: { x: number; y: number; heading: number };
}

export interface RoundedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface ArenaGeometry {
  width: number;
  height: number;
  obstacles: RoundedRect[];
}

export function islandToRect(island: IslandDefinition): RoundedRect {
  const width = island.cols * CELL_SIZE;
  const height = island.rows * CELL_SIZE;
  return {
    x: island.col * CELL_SIZE,
    y: island.row * CELL_SIZE,
    width,
    height,
    radius: Math.min(CELL_SIZE * 0.78, width / 2, height / 2),
  };
}

export function buildGeometry(definition: ArenaDefinition): ArenaGeometry {
  return {
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    obstacles: definition.islands.map(islandToRect),
  };
}

export interface Penetration {
  x: number;
  y: number;
  depth: number;
}

export function circleRoundedRectPenetration(
  cx: number,
  cy: number,
  radius: number,
  rect: RoundedRect,
): Penetration | null {
  const innerLeft = rect.x + rect.radius;
  const innerTop = rect.y + rect.radius;
  const innerRight = rect.x + rect.width - rect.radius;
  const innerBottom = rect.y + rect.height - rect.radius;
  const nearestX = clamp(cx, innerLeft, innerRight);
  const nearestY = clamp(cy, innerTop, innerBottom);
  let dx = cx - nearestX;
  let dy = cy - nearestY;
  const combined = radius + rect.radius;
  const distSq = dx * dx + dy * dy;
  if (distSq >= combined * combined) return null;
  const dist = Math.sqrt(distSq);
  if (dist === 0) {
    const toLeft = cx - rect.x;
    const toRight = rect.x + rect.width - cx;
    const toTop = cy - rect.y;
    const toBottom = rect.y + rect.height - cy;
    const smallest = Math.min(toLeft, toRight, toTop, toBottom);
    dx = smallest === toLeft ? -1 : smallest === toRight ? 1 : 0;
    dy = dx === 0 ? (smallest === toTop ? -1 : 1) : 0;
    return { x: dx, y: dy, depth: smallest + radius };
  }
  return { x: dx / dist, y: dy / dist, depth: combined - dist };
}

export function pointInsideObstacle(
  x: number,
  y: number,
  obstacles: readonly RoundedRect[],
  margin = 0,
): boolean {
  for (const rect of obstacles) {
    if (circleRoundedRectPenetration(x, y, margin, rect)) return true;
  }
  return false;
}

export function pointInsideArena(x: number, y: number, geometry: ArenaGeometry, margin = 0): boolean {
  return x >= margin && y >= margin && x <= geometry.width - margin && y <= geometry.height - margin;
}
