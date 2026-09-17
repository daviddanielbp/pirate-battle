import type { ShipKind } from '../core/entities';

export const SHIP_SPRITE_SCALE = 0.92;
export const SHIP_SPRITE_ROTATION_OFFSET = Math.PI / 2;

const SHIP_BASE_INDEX: Record<ShipKind, number> = {
  player: 2,
  chaser: 3,
  shooter: 5,
};

export interface FleetAppearance {
  playerSpriteIndex: number;
}

export const DEFAULT_APPEARANCE: FleetAppearance = { playerSpriteIndex: SHIP_BASE_INDEX.player };

function baseIndex(kind: ShipKind, appearance: FleetAppearance): number {
  return kind === 'player' ? appearance.playerSpriteIndex : SHIP_BASE_INDEX[kind];
}

export function shipTextureName(kind: ShipKind, healthRatio: number, appearance: FleetAppearance): string {
  const tier = healthRatio > 0.66 ? 0 : healthRatio > 0.33 ? 1 : 2;
  return `ship_${baseIndex(kind, appearance) + tier * 6}`;
}

export function wreckTextureName(kind: ShipKind, appearance: FleetAppearance): string {
  return `ship_${baseIndex(kind, appearance) + 18}`;
}

export const SAND_TILES = {
  topLeft: 1,
  top: 2,
  topRight: 3,
  left: 17,
  center: 18,
  right: 19,
  bottomLeft: 33,
  bottom: 34,
  bottomRight: 35,
} as const;

export const SHALLOW_TILES = {
  topLeft: 10,
  top: 11,
  topRight: 12,
  left: 26,
  center: 27,
  right: 28,
  bottomLeft: 42,
  bottom: 43,
  bottomRight: 44,
} as const;

export const GRASS_ISLAND_TILES: readonly (readonly number[])[] = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
];

export const WATER_TILE = 73;

export const LAYER_DEPTH = {
  water: 0,
  shallows: 1,
  islands: 2,
  wrecks: 3,
  projectiles: 4,
  ships: 5,
  effects: 6,
  overlays: 7,
} as const;
