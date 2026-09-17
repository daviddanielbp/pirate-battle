export type ShipKind = 'player' | 'chaser' | 'shooter';
export type Faction = 'player' | 'enemy';
export type WeaponSlot = 'front' | 'left' | 'right';
export type EndReason = 'time_up' | 'defeated';
export type MatchStatus = 'running' | 'ended';

export interface ShipCommand {
  forward: boolean;
  turn: -1 | 0 | 1;
  targetHeading: number | null;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

export const IDLE_COMMAND: Readonly<ShipCommand> = Object.freeze({
  forward: false,
  turn: 0,
  targetHeading: null,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
});

export interface Ship {
  id: number;
  kind: ShipKind;
  faction: Faction;
  x: number;
  y: number;
  heading: number;
  speed: number;
  health: number;
  maxHealth: number;
  radius: number;
  halfLength: number;
  cooldowns: Record<WeaponSlot, number>;
  aiMode: 'approach' | 'hold' | 'retreat';
}

export interface Projectile {
  id: number;
  faction: Faction;
  ownerId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  remainingLife: number;
}

export type SimulationEvent =
  | { type: 'fire'; shipId: number; kind: ShipKind; slot: WeaponSlot; x: number; y: number; angle: number }
  | { type: 'hit'; shipId: number; kind: ShipKind; x: number; y: number; damage: number; health: number }
  | { type: 'destroyed'; shipId: number; kind: ShipKind; x: number; y: number; scored: boolean }
  | { type: 'splash'; x: number; y: number }
  | { type: 'island_hit'; x: number; y: number }
  | { type: 'bump'; shipId: number; kind: ShipKind; x: number; y: number }
  | { type: 'chaser_impact'; x: number; y: number; damage: number }
  | { type: 'spawn'; shipId: number; kind: ShipKind; x: number; y: number }
  | { type: 'score'; score: number }
  | { type: 'ended'; reason: EndReason };

export function shipBow(ship: Ship): { x: number; y: number } {
  return {
    x: ship.x + Math.cos(ship.heading) * ship.halfLength,
    y: ship.y + Math.sin(ship.heading) * ship.halfLength,
  };
}

export function shipStern(ship: Ship): { x: number; y: number } {
  return {
    x: ship.x - Math.cos(ship.heading) * ship.halfLength,
    y: ship.y - Math.sin(ship.heading) * ship.halfLength,
  };
}

export function healthRatio(ship: Ship): number {
  return ship.maxHealth === 0 ? 0 : Math.max(0, ship.health / ship.maxHealth);
}
