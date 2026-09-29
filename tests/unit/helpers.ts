import { DEFAULT_GAMEPLAY_CONFIG, type GameplayConfig } from '@/game/config/gameplayConfig';
import type { ArenaDefinition, IslandDefinition } from '@/game/core/arena';
import type { Ship, ShipKind } from '@/game/core/entities';
import { MatchSimulation } from '@/game/core/simulation';

export const STEP = DEFAULT_GAMEPLAY_CONFIG.fixedStepSeconds;

/** Config with spawns pushed past the end of the match, so tests place enemies by hand. */
export function quietConfig(overrides: Partial<GameplayConfig> = {}): GameplayConfig {
  return {
    ...DEFAULT_GAMEPLAY_CONFIG,
    spawn: { ...DEFAULT_GAMEPLAY_CONFIG.spawn, initialDelaySeconds: 10_000 },
    ...overrides,
  };
}

export function openArena(islands: IslandDefinition[] = []): ArenaDefinition {
  return { id: 'test', name: 'Test sea', islands, playerStart: { x: 400, y: 512, heading: 0 } };
}

export function createSimulation(config = quietConfig(), arena = openArena()): MatchSimulation {
  return new MatchSimulation({ config, arena, seed: 1 });
}

let nextTestId = 1000;

/** Places an enemy directly in the simulation, bypassing the spawner. */
export function placeEnemy(
  simulation: MatchSimulation,
  kind: Exclude<ShipKind, 'player'>,
  x: number,
  y: number,
  heading = Math.PI,
): Ship {
  const config = kind === 'chaser' ? simulation.config.chaser : simulation.config.shooter;
  const ship: Ship = {
    id: nextTestId++,
    kind,
    faction: 'enemy',
    x,
    y,
    heading,
    speed: 0,
    health: config.maxHealth,
    maxHealth: config.maxHealth,
    radius: config.hitbox.radius,
    halfLength: config.hitbox.halfLength,
    cooldowns: { front: 0, left: 0, right: 0 },
    aiMode: 'approach',
  };
  simulation.ships.push(ship);
  return ship;
}

export function run(simulation: MatchSimulation, seconds: number): void {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) simulation.step(STEP);
}
