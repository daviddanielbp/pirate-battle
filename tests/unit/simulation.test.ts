import { describe, expect, it } from 'vitest';
import { IDLE_COMMAND } from '@/game/core/entities';
import { createSimulation, placeEnemy, quietConfig, run, STEP } from './helpers';

const fire = { ...IDLE_COMMAND, fireFront: true };

describe('MatchSimulation — combat', () => {
  it('applies front-cannon damage exactly once and removes the projectile', () => {
    const simulation = createSimulation();
    // Shooter far enough that it never fires back during the test window.
    const target = placeEnemy(simulation, 'shooter', 700, 512);
    target.cooldowns.front = 100;
    simulation.setCommand(fire);
    simulation.step(STEP);
    simulation.clearCommand();
    expect(simulation.projectiles.filter((p) => p.faction === 'player')).toHaveLength(1);

    run(simulation, 1);

    expect(target.health).toBe(target.maxHealth - simulation.config.player.frontCannon.damage);
    expect(simulation.projectiles.filter((p) => p.faction === 'player')).toHaveLength(0);
  });

  it('respects the front-cannon cooldown while the trigger is held', () => {
    const simulation = createSimulation();
    simulation.setCommand(fire);
    const cooldown = simulation.config.player.frontCannon.cooldownSeconds;
    // Hold the trigger for just under one cooldown: only the first shot leaves the barrel.
    run(simulation, cooldown - STEP * 2);
    const shots = simulation.drainEvents().filter((event) => event.type === 'fire');
    expect(shots).toHaveLength(1);
  });

  it('fires three parallel projectiles per broadside', () => {
    const simulation = createSimulation();
    simulation.setCommand({ ...IDLE_COMMAND, fireLeft: true });
    simulation.step(STEP);
    const volley = simulation.projectiles.filter((p) => p.faction === 'player');
    expect(volley).toHaveLength(simulation.config.player.broadside.projectileCount);
    const [first] = volley;
    for (const projectile of volley) {
      expect(projectile.vx).toBeCloseTo(first?.vx ?? NaN);
      expect(projectile.vy).toBeCloseTo(first?.vy ?? NaN);
    }
  });

  it('scores one point per enemy sunk by the player', () => {
    const simulation = createSimulation();
    const target = placeEnemy(simulation, 'chaser', 560, 512);
    target.health = 1;
    simulation.setCommand(fire);
    simulation.step(STEP);
    simulation.clearCommand();
    run(simulation, 0.5);
    expect(simulation.ships.includes(target)).toBe(false);
    expect(simulation.score).toBe(1);
    expect(simulation.kills.chaser).toBe(1);
  });

  it('does not score when a Chaser detonates against the player', () => {
    const simulation = createSimulation();
    const player = simulation.player;
    placeEnemy(simulation, 'chaser', player.x + 60, player.y);
    run(simulation, 1);
    expect(simulation.ships.filter((ship) => ship.faction === 'enemy')).toHaveLength(0);
    expect(player.health).toBe(player.maxHealth - simulation.config.chaser.contactDamage);
    expect(simulation.score).toBe(0);
  });
});

describe('MatchSimulation — match rules', () => {
  it('ends by time and freezes afterwards', () => {
    const config = quietConfig();
    const simulation = createSimulation({ ...config, session: { durationSeconds: 60 } });
    run(simulation, 61);
    expect(simulation.status).toBe('ended');
    expect(simulation.endReason).toBe('time_up');
    expect(simulation.elapsed).toBe(60);

    const before = { x: simulation.player.x, elapsed: simulation.elapsed };
    simulation.setCommand({ ...IDLE_COMMAND, forward: true });
    run(simulation, 1);
    expect(simulation.player.x).toBe(before.x);
    expect(simulation.elapsed).toBe(before.elapsed);
  });

  it('ends by defeat when health reaches zero', () => {
    const simulation = createSimulation();
    simulation.player.health = 1;
    placeEnemy(simulation, 'chaser', simulation.player.x + 60, simulation.player.y);
    run(simulation, 1);
    expect(simulation.status).toBe('ended');
    expect(simulation.endReason).toBe('defeated');
  });

  it('spawns both enemy types away from the player at the configured interval', () => {
    const base = quietConfig();
    const simulation = createSimulation({
      ...base,
      spawn: { ...base.spawn, initialDelaySeconds: 1, intervalSeconds: 2, maxEnemies: 6 },
    });
    run(simulation, 1.05);
    expect(simulation.ships).toHaveLength(2);
    run(simulation, 2);
    expect(simulation.ships).toHaveLength(3);
    const kinds = simulation.ships.filter((ship) => ship.faction === 'enemy').map((ship) => ship.kind);
    expect(kinds).toEqual(expect.arrayContaining(['chaser', 'shooter']));
  });

  it('is deterministic for the same seed and inputs', () => {
    const base = quietConfig();
    const config = { ...base, spawn: { ...base.spawn, initialDelaySeconds: 0.5, intervalSeconds: 1 } };
    const a = createSimulation(config);
    const b = createSimulation(config);
    for (const simulation of [a, b]) {
      simulation.setCommand({ ...IDLE_COMMAND, forward: true, turn: 1, fireFront: true });
      run(simulation, 8);
    }
    expect(a.ships.map((ship) => [ship.x, ship.y, ship.health])).toEqual(
      b.ships.map((ship) => [ship.x, ship.y, ship.health]),
    );
    expect(a.score).toBe(b.score);
  });
});

describe('MatchSimulation — arena', () => {
  it('keeps the player inside the arena bounds', () => {
    const simulation = createSimulation();
    simulation.setCommand({ ...IDLE_COMMAND, forward: true });
    run(simulation, 20);
    const { player, geometry } = simulation;
    expect(player.x + player.halfLength + player.radius).toBeLessThanOrEqual(geometry.width + 1e-6);
  });

  it('does not let the player sail through an island', () => {
    // A 2x6 island (cells 8..9, rows 5..10) directly ahead of the player start.
    const island = { col: 8, row: 5, cols: 2, rows: 6, style: 'sand' as const };
    const simulation = createSimulation(quietConfig(), {
      id: 'wall',
      name: 'Wall',
      islands: [island],
      playerStart: { x: 300, y: 512, heading: 0 },
    });
    simulation.setCommand({ ...IDLE_COMMAND, forward: true });
    run(simulation, 6);
    const islandLeftEdge = island.col * 64;
    expect(simulation.player.x).toBeLessThan(islandLeftEdge);
  });
});
