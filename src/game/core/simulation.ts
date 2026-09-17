import {
  buildGeometry,
  pointInsideArena,
  pointInsideObstacle,
  type ArenaDefinition,
  type ArenaGeometry,
} from './arena';
import {
  clampShipToArena,
  projectileHitsShip,
  resolveShipObstacles,
  segmentClear,
  separateShips,
  shipsOverlap,
} from './collisions';
import {
  IDLE_COMMAND,
  type EndReason,
  type Faction,
  type MatchStatus,
  type Projectile,
  type Ship,
  type ShipCommand,
  type ShipKind,
  type SimulationEvent,
  type WeaponSlot,
} from './entities';
import { angleDelta, clamp, distance, rotateTowards, wrapAngle } from './math';
import { createRandom, type RandomSource } from './rng';
import { NavigationGrid } from './navigation';
import { findClearHeading, separationHeadingBias } from './steering';
import type { GameplayConfig, ShipMotionConfig, WeaponConfig } from '../config/gameplayConfig';
import type { KillCount } from '../progression/progression';

const REST_SPEED = 2;

export interface SimulationOptions {
  config: GameplayConfig;
  arena: ArenaDefinition;
  seed: number;
}

export interface MatchSummary {
  status: MatchStatus;
  endReason: EndReason | null;
  score: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  playerHealth: number;
  playerMaxHealth: number;
  enemyCount: number;
  kills: KillCount;
}

export class MatchSimulation {
  readonly config: GameplayConfig;
  readonly arena: ArenaDefinition;
  readonly geometry: ArenaGeometry;
  readonly ships: Ship[] = [];
  readonly projectiles: Projectile[] = [];
  readonly events: SimulationEvent[] = [];
  readonly player: Ship;
  private readonly navigation: NavigationGrid;

  status: MatchStatus = 'running';
  endReason: EndReason | null = null;
  score = 0;
  elapsed = 0;
  readonly kills: KillCount = { chaser: 0, shooter: 0 };

  private readonly random: RandomSource;
  private nextId = 1;
  private spawnTimer: number;
  private spawnCount = 0;
  private command: ShipCommand = { ...IDLE_COMMAND };

  constructor(options: SimulationOptions) {
    this.config = options.config;
    this.arena = options.arena;
    this.geometry = buildGeometry(options.arena);
    this.random = createRandom(options.seed);
    this.navigation = new NavigationGrid(this.geometry, this.config.chaser.hitbox.radius + 8);
    this.spawnTimer = this.config.spawn.initialDelaySeconds;
    const start = options.arena.playerStart;
    this.player = this.createShip('player', start.x, start.y, start.heading);
  }

  get remainingSeconds(): number {
    return Math.max(0, this.config.session.durationSeconds - this.elapsed);
  }

  get enemies(): Ship[] {
    return this.ships.filter((ship) => ship.faction === 'enemy');
  }

  setCommand(command: ShipCommand): void {
    this.command = { ...command };
  }

  clearCommand(): void {
    this.command = { ...IDLE_COMMAND };
  }

  summary(): MatchSummary {
    return {
      status: this.status,
      endReason: this.endReason,
      score: this.score,
      elapsedSeconds: this.elapsed,
      remainingSeconds: this.remainingSeconds,
      playerHealth: this.player.health,
      playerMaxHealth: this.player.maxHealth,
      enemyCount: this.ships.length - 1,
      kills: { ...this.kills },
    };
  }

  drainEvents(): SimulationEvent[] {
    if (this.events.length === 0) return [];
    return this.events.splice(0, this.events.length);
  }

  step(dt: number): void {
    if (this.status !== 'running') return;
    this.elapsed += dt;
    this.updateCooldowns(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.resolveShipCollisions();
    this.updateSpawner(dt);
    if (this.player.health <= 0) {
      this.finish('defeated');
      return;
    }
    if (this.elapsed >= this.config.session.durationSeconds) {
      this.elapsed = this.config.session.durationSeconds;
      this.finish('time_up');
    }
  }

  private finish(reason: EndReason): void {
    this.status = 'ended';
    this.endReason = reason;
    this.command = { ...IDLE_COMMAND };
    this.events.push({ type: 'ended', reason });
  }

  private createShip(kind: ShipKind, x: number, y: number, heading: number): Ship {
    const config =
      kind === 'player' ? this.config.player : kind === 'chaser' ? this.config.chaser : this.config.shooter;
    const ship: Ship = {
      id: this.nextId++,
      kind,
      faction: kind === 'player' ? 'player' : 'enemy',
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
    this.ships.push(ship);
    return ship;
  }

  private updateCooldowns(dt: number): void {
    for (const ship of this.ships) {
      ship.cooldowns.front = Math.max(0, ship.cooldowns.front - dt);
      ship.cooldowns.left = Math.max(0, ship.cooldowns.left - dt);
      ship.cooldowns.right = Math.max(0, ship.cooldowns.right - dt);
    }
  }

  private integrateMotion(
    ship: Ship,
    motion: ShipMotionConfig,
    throttle: boolean,
    turn: number,
    dt: number,
  ): void {
    if (turn !== 0) ship.heading = wrapAngle(ship.heading + turn * motion.rotationSpeed * dt);
    if (throttle) ship.speed += motion.acceleration * dt;
    ship.speed -= ship.speed * motion.drag * dt;
    ship.speed = clamp(ship.speed, 0, motion.maxSpeed);
    if (ship.speed < REST_SPEED && !throttle) ship.speed = 0;
    ship.x += Math.cos(ship.heading) * ship.speed * dt;
    ship.y += Math.sin(ship.heading) * ship.speed * dt;
    this.settleAgainstWorld(ship);
  }

  private settleAgainstWorld(ship: Ship): void {
    const contact = resolveShipObstacles(ship, this.geometry);
    const touchedEdge = clampShipToArena(ship, this.geometry);
    if (contact && contact.depth > 2 && ship.speed > 40) {
      this.events.push({ type: 'bump', shipId: ship.id, kind: ship.kind, x: ship.x, y: ship.y });
    }
    if (contact || touchedEdge) ship.speed *= 0.35;
  }

  private updatePlayer(dt: number): void {
    const { player, command } = this;
    const motion = this.config.player.motion;
    if (command.targetHeading !== null && command.turn === 0) {
      player.heading = rotateTowards(player.heading, command.targetHeading, motion.rotationSpeed * dt);
    }
    this.integrateMotion(player, motion, command.forward, command.turn, dt);
    const regeneration = this.config.player.regeneration;
    if (
      regeneration.healthPerSecond > 0 &&
      player.speed >= regeneration.minimumSpeed &&
      player.health < player.maxHealth
    ) {
      player.health = Math.min(player.maxHealth, player.health + regeneration.healthPerSecond * dt);
    }
    if (command.fireFront) this.fireFront(player, this.config.player.frontCannon);
    if (command.fireLeft) this.fireBroadside(player, 'left');
    if (command.fireRight) this.fireBroadside(player, 'right');
  }

  private fireFront(ship: Ship, weapon: WeaponConfig): boolean {
    if (ship.cooldowns.front > 0) return false;
    ship.cooldowns.front = weapon.cooldownSeconds;
    const angle = ship.heading;
    const originX = ship.x + Math.cos(angle) * (ship.halfLength + 6);
    const originY = ship.y + Math.sin(angle) * (ship.halfLength + 6);
    const sideX = -Math.sin(angle);
    const sideY = Math.cos(angle);
    const count = Math.max(1, weapon.projectileCount);
    const start = -((count - 1) / 2) * weapon.projectileSpacing;
    for (let index = 0; index < count; index += 1) {
      const offset = start + index * weapon.projectileSpacing;
      this.spawnProjectile(ship, originX + sideX * offset, originY + sideY * offset, angle, weapon);
    }
    if (weapon.sideShots) {
      for (const side of [-1, 1]) {
        const sideAngle = wrapAngle(angle + (side * Math.PI) / 2);
        const sideOriginX = ship.x + Math.cos(sideAngle) * (ship.radius + 4);
        const sideOriginY = ship.y + Math.sin(sideAngle) * (ship.radius + 4);
        this.spawnProjectile(ship, sideOriginX, sideOriginY, sideAngle, weapon);
      }
    }
    this.events.push({
      type: 'fire',
      shipId: ship.id,
      kind: ship.kind,
      slot: 'front',
      x: originX,
      y: originY,
      angle,
    });
    return true;
  }

  private fireBroadside(ship: Ship, side: 'left' | 'right'): void {
    if (ship.cooldowns[side] > 0) return;
    const weapon = this.config.player.broadside;
    ship.cooldowns[side] = weapon.cooldownSeconds;
    const angle = wrapAngle(ship.heading + (side === 'left' ? -Math.PI / 2 : Math.PI / 2));
    const alongX = Math.cos(ship.heading);
    const alongY = Math.sin(ship.heading);
    const offsetX = Math.cos(angle) * (ship.radius + 4);
    const offsetY = Math.sin(angle) * (ship.radius + 4);
    const count = weapon.projectileCount;
    const start = -((count - 1) / 2) * weapon.projectileSpacing;
    for (let index = 0; index < count; index += 1) {
      const along = start + index * weapon.projectileSpacing;
      const originX = ship.x + alongX * along + offsetX;
      const originY = ship.y + alongY * along + offsetY;
      this.spawnProjectile(ship, originX, originY, angle, weapon);
    }
    this.events.push({
      type: 'fire',
      shipId: ship.id,
      kind: ship.kind,
      slot: side,
      x: ship.x + offsetX,
      y: ship.y + offsetY,
      angle,
    });
  }

  private spawnProjectile(owner: Ship, x: number, y: number, angle: number, weapon: WeaponConfig): void {
    this.projectiles.push({
      id: this.nextId++,
      faction: owner.faction,
      ownerId: owner.id,
      x,
      y,
      vx: Math.cos(angle) * weapon.projectileSpeed,
      vy: Math.sin(angle) * weapon.projectileSpeed,
      damage: weapon.damage,
      radius: weapon.projectileRadius,
      remainingLife: weapon.projectileLifetimeSeconds,
    });
  }

  private updateEnemies(dt: number): void {
    const player = this.player;
    const enemies = this.ships.filter((ship) => ship.faction === 'enemy');
    for (const enemy of enemies) {
      if (enemy.kind === 'chaser') this.updateChaser(enemy, enemies, dt);
      else this.updateShooter(enemy, enemies, dt);
      if (enemy.kind === 'chaser' && shipsOverlap(enemy, player)) this.detonateChaser(enemy);
    }
  }

  private steerTowards(ship: Ship, targetX: number, targetY: number, others: readonly Ship[]): number {
    const bias = separationHeadingBias(ship, others, 120);
    let goalX = targetX;
    let goalY = targetY;
    if (!segmentClear(ship.x, ship.y, targetX, targetY, this.geometry, ship.radius, 12)) {
      this.navigation.updateTarget(targetX, targetY);
      const waypoint = this.navigation.nextWaypoint(ship.x, ship.y);
      if (waypoint) {
        goalX = waypoint.x;
        goalY = waypoint.y;
      }
    }
    const dx = goalX - ship.x + bias.x * 70;
    const dy = goalY - ship.y + bias.y * 70;
    const desired = Math.atan2(dy, dx);
    return findClearHeading(ship, desired, this.geometry, distance(ship.x, ship.y, goalX, goalY));
  }

  private updateChaser(chaser: Ship, enemies: readonly Ship[], dt: number): void {
    const player = this.player;
    const lead = 0.25;
    const targetX = player.x + Math.cos(player.heading) * player.speed * lead;
    const targetY = player.y + Math.sin(player.heading) * player.speed * lead;
    const heading = this.steerTowards(chaser, targetX, targetY, enemies);
    const motion = this.config.chaser.motion;
    chaser.heading = rotateTowards(chaser.heading, heading, motion.rotationSpeed * dt);
    this.integrateMotion(chaser, motion, true, 0, dt);
  }

  private updateShooter(shooter: Ship, enemies: readonly Ship[], dt: number): void {
    const player = this.player;
    const config = this.config.shooter;
    const dist = distance(shooter.x, shooter.y, player.x, player.y);
    const toPlayer = Math.atan2(player.y - shooter.y, player.x - shooter.x);
    const lineOfSight = segmentClear(shooter.x, shooter.y, player.x, player.y, this.geometry, 4, 10);
    if (dist > config.preferredDistance + 50 || !lineOfSight) shooter.aiMode = 'approach';
    else if (dist < config.preferredDistance - 70) shooter.aiMode = 'retreat';
    else shooter.aiMode = 'hold';

    let desired: number;
    let throttle = true;
    if (shooter.aiMode === 'approach') {
      desired = this.steerTowards(shooter, player.x, player.y, enemies);
    } else if (shooter.aiMode === 'retreat') {
      const awayX = shooter.x - Math.cos(toPlayer) * 240;
      const awayY = shooter.y - Math.sin(toPlayer) * 240;
      desired = this.steerTowards(shooter, awayX, awayY, enemies);
    } else {
      desired = findClearHeading(shooter, toPlayer, this.geometry, dist);
      const deflected = Math.abs(angleDelta(toPlayer, desired)) > 0.01;
      if (deflected) desired = this.steerTowards(shooter, player.x, player.y, enemies);
      throttle = deflected || Math.abs(angleDelta(shooter.heading, desired)) > 0.6;
    }
    shooter.heading = rotateTowards(shooter.heading, desired, config.motion.rotationSpeed * dt);
    this.integrateMotion(shooter, config.motion, throttle, 0, dt);

    const aimError = Math.abs(angleDelta(shooter.heading, toPlayer));
    if (
      dist <= config.attackRange &&
      aimError <= config.aimToleranceRadians &&
      shooter.cooldowns.front <= 0 &&
      lineOfSight
    ) {
      this.fireFront(shooter, config.cannon);
    }
  }

  private detonateChaser(chaser: Ship): void {
    const damage = this.config.chaser.contactDamage;
    this.applyDamage(this.player, damage);
    this.events.push({ type: 'chaser_impact', x: chaser.x, y: chaser.y, damage });
    this.destroyShip(chaser, false);
  }

  private applyDamage(ship: Ship, damage: number): void {
    ship.health = Math.max(0, ship.health - damage);
    this.events.push({
      type: 'hit',
      shipId: ship.id,
      kind: ship.kind,
      x: ship.x,
      y: ship.y,
      damage,
      health: ship.health,
    });
  }

  private destroyShip(ship: Ship, scored: boolean): void {
    const index = this.ships.indexOf(ship);
    if (index === -1) return;
    this.ships.splice(index, 1);
    if (scored) {
      this.score += 1;
      if (ship.kind !== 'player') this.kills[ship.kind] += 1;
      this.events.push({ type: 'score', score: this.score });
    }
    this.events.push({ type: 'destroyed', shipId: ship.id, kind: ship.kind, x: ship.x, y: ship.y, scored });
  }

  private updateProjectiles(dt: number): void {
    const { projectiles, geometry } = this;
    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index];
      if (!projectile) continue;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.remainingLife -= dt;
      if (projectile.remainingLife <= 0) {
        this.events.push({ type: 'splash', x: projectile.x, y: projectile.y });
        projectiles.splice(index, 1);
        continue;
      }
      if (!pointInsideArena(projectile.x, projectile.y, geometry, -projectile.radius)) {
        projectiles.splice(index, 1);
        continue;
      }
      if (pointInsideObstacle(projectile.x, projectile.y, geometry.obstacles, projectile.radius * 0.5)) {
        this.events.push({ type: 'island_hit', x: projectile.x, y: projectile.y });
        projectiles.splice(index, 1);
        continue;
      }
      const target = this.findProjectileTarget(projectile);
      if (target) {
        projectiles.splice(index, 1);
        this.applyDamage(target, projectile.damage);
        if (target.health <= 0 && target.faction === 'enemy')
          this.destroyShip(target, projectile.faction === 'player');
      }
    }
  }

  private findProjectileTarget(projectile: Projectile): Ship | null {
    const targetFaction: Faction = projectile.faction === 'player' ? 'enemy' : 'player';
    for (const ship of this.ships) {
      if (ship.faction !== targetFaction) continue;
      if (projectileHitsShip(projectile, ship)) return ship;
    }
    return null;
  }

  private resolveShipCollisions(): void {
    const ships = [...this.ships];
    for (let i = 0; i < ships.length; i += 1) {
      const a = ships[i];
      if (!a) continue;
      for (let j = i + 1; j < ships.length; j += 1) {
        const b = ships[j];
        if (!b) continue;
        if (!this.ships.includes(a) || !this.ships.includes(b) || !shipsOverlap(a, b)) continue;
        if (a.kind === 'chaser' && b.kind === 'player') {
          this.detonateChaser(a);
          continue;
        }
        if (b.kind === 'chaser' && a.kind === 'player') {
          this.detonateChaser(b);
          continue;
        }
        separateShips(a, b, 0.5, 0.5);
        a.speed *= 0.92;
        b.speed *= 0.92;
      }
    }
    for (const ship of this.ships) {
      resolveShipObstacles(ship, this.geometry);
      clampShipToArena(ship, this.geometry);
    }
  }

  private updateSpawner(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer += this.config.spawn.intervalSeconds;
    if (this.ships.length - 1 >= this.config.spawn.maxEnemies) return;
    const kind = this.pickSpawnKind();
    const point = this.pickSpawnPoint(kind);
    if (!point) return;
    const heading = Math.atan2(this.player.y - point.y, this.player.x - point.x);
    const ship = this.createShip(kind, point.x, point.y, heading);
    this.spawnCount += 1;
    this.events.push({ type: 'spawn', shipId: ship.id, kind, x: ship.x, y: ship.y });
  }

  private pickSpawnKind(): ShipKind {
    if (this.spawnCount === 0) return 'chaser';
    if (this.spawnCount === 1) return 'shooter';
    const { chaser, shooter } = this.config.spawn.distribution;
    const total = chaser + shooter;
    const roll = this.random.next() * (total > 0 ? total : 1);
    return roll < chaser ? 'chaser' : 'shooter';
  }

  private pickSpawnPoint(kind: ShipKind): { x: number; y: number } | null {
    const hitbox = kind === 'chaser' ? this.config.chaser.hitbox : this.config.shooter.hitbox;
    const clearance = hitbox.halfLength + hitbox.radius + 16;
    const edgeMargin = clearance + 24;
    const minPlayerDistance = this.config.spawn.minDistanceFromPlayer;
    let fallback: { x: number; y: number; score: number } | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = this.random.range(edgeMargin, this.geometry.width - edgeMargin);
      const y = this.random.range(edgeMargin, this.geometry.height - edgeMargin);
      if (pointInsideObstacle(x, y, this.geometry.obstacles, clearance)) continue;
      const playerDistance = distance(x, y, this.player.x, this.player.y);
      let crowded = false;
      for (const ship of this.ships) {
        if (ship.faction === 'enemy' && distance(x, y, ship.x, ship.y) < clearance * 2) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      if (playerDistance >= minPlayerDistance) return { x, y };
      if (!fallback || playerDistance > fallback.score) fallback = { x, y, score: playerDistance };
    }
    return fallback && fallback.score >= minPlayerDistance * 0.6 ? { x: fallback.x, y: fallback.y } : null;
  }
}

export function weaponSlotForCommand(slot: WeaponSlot): keyof ShipCommand {
  return slot === 'front' ? 'fireFront' : slot === 'left' ? 'fireLeft' : 'fireRight';
}
