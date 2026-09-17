import type { GameplayConfig } from '../config/gameplayConfig';
import type { ShipKind } from '../core/entities';

export type HullId = 'skull' | 'white' | 'red' | 'green' | 'blue' | 'yellow';
export type CannonId = 'single' | 'double' | 'broadside';
export type UpgradeId = 'health' | 'damage' | 'speed';

export interface UpgradeLevels {
  health: number;
  damage: number;
  speed: number;
}

export interface PlayerProgress {
  coins: number;
  xp: number;
  hull: HullId;
  cannon: CannonId;
  upgrades: UpgradeLevels;
  ownedHulls: HullId[];
  ownedCannons: CannonId[];
}

export interface MatchLoadout {
  level: number;
  hull: HullId;
  cannon: CannonId;
  upgrades: UpgradeLevels;
}

export interface MatchRewards {
  coins: number;
  xp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface KillCount {
  chaser: number;
  shooter: number;
}

export const UPGRADE_STEP = 0.1;
export const MAX_UPGRADE_LEVEL = 4;
export const COINS_PER_KILL = 1;
export const XP_REWARD: Readonly<Record<Exclude<ShipKind, 'player'>, number>> = { chaser: 1, shooter: 2 };
export const BASE_LEVEL_XP = 30;
export const LEVEL_XP_INCREMENT = 10;
export const ENEMY_HEALTH_PER_LEVEL = 0.1;
export const DOUBLE_CANNON_DAMAGE_MULTIPLIER = 1.5;

export const HULL_SPRITE_INDEX: Readonly<Record<HullId, number>> = {
  white: 1,
  skull: 2,
  red: 3,
  green: 4,
  blue: 5,
  yellow: 6,
};

export interface HullTraits {
  speed: number;
  health: number;
  damage: number;
  cooldown: number;
  regenerationPerSecond: number;
  doubleCoinChance: number;
}

export interface HullItem {
  id: HullId;
  name: string;
  price: number;
  trait: string;
  traits: HullTraits;
}

const NEUTRAL_TRAITS: HullTraits = {
  speed: 1,
  health: 1,
  damage: 1,
  cooldown: 1,
  regenerationPerSecond: 0,
  doubleCoinChance: 0,
};

export interface CannonItem {
  id: CannonId;
  name: string;
  description: string;
  price: number;
}

export interface UpgradeItem {
  id: UpgradeId;
  name: string;
  description: string;
  prices: readonly number[];
}

export const HULL_CATALOG: readonly HullItem[] = [
  { id: 'skull', name: 'Black Skull', price: 0, trait: 'Balanced hull with no modifiers.', traits: NEUTRAL_TRAITS },
  {
    id: 'white',
    name: 'White Sails',
    price: 20,
    trait: 'Fastest hull (+15% speed) but fragile (-15% health).',
    traits: { ...NEUTRAL_TRAITS, speed: 1.15, health: 0.85 },
  },
  {
    id: 'red',
    name: 'Crimson Cross',
    price: 30,
    trait: 'Heaviest guns (+20% damage) but fragile (-15% health) and slow (-10% speed).',
    traits: { ...NEUTRAL_TRAITS, damage: 1.2, health: 0.85, speed: 0.9 },
  },
  {
    id: 'green',
    name: 'Jade Blades',
    price: 30,
    trait: 'Repairs 2 health per second while sailing.',
    traits: { ...NEUTRAL_TRAITS, regenerationPerSecond: 2 },
  },
  {
    id: 'blue',
    name: 'Azure Steed',
    price: 40,
    trait: 'Cannons reload 25% faster.',
    traits: { ...NEUTRAL_TRAITS, cooldown: 0.75 },
  },
  {
    id: 'yellow',
    name: 'Golden Bones',
    price: 60,
    trait: 'Every enemy sunk has a 35% chance to drop double coins.',
    traits: { ...NEUTRAL_TRAITS, doubleCoinChance: 0.35 },
  },
];

export const CANNON_CATALOG: readonly CannonItem[] = [
  { id: 'single', name: 'Iron Cannon', description: 'One cannonball per shot.', price: 0 },
  {
    id: 'double',
    name: 'Twin Cannon',
    description: 'Two cannonballs per shot dealing 1.5x the damage in total.',
    price: 50,
  },
  {
    id: 'broadside',
    name: 'Broadside Cannon',
    description: 'Fires ahead and to both sides at once: three cannonballs at 0.7x damage each.',
    price: 90,
  },
];

export const BROADSIDE_CANNON_DAMAGE_MULTIPLIER = 0.7;

export const UPGRADE_CATALOG: readonly UpgradeItem[] = [
  { id: 'health', name: 'Reinforced hull', description: '+10% max health per level.', prices: [20, 35, 50, 70] },
  { id: 'damage', name: 'Heavy shot', description: '+10% cannon damage per level.', prices: [25, 40, 60, 80] },
  { id: 'speed', name: 'Silk sails', description: '+10% speed per level.', prices: [20, 35, 50, 70] },
];

export const DEFAULT_PROGRESS: PlayerProgress = {
  coins: 0,
  xp: 0,
  hull: 'skull',
  cannon: 'single',
  upgrades: { health: 0, damage: 0, speed: 0 },
  ownedHulls: ['skull'],
  ownedCannons: ['single'],
};

export function xpToNextLevel(level: number): number {
  return BASE_LEVEL_XP + (level - 1) * LEVEL_XP_INCREMENT;
}

export interface LevelState {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
}

export function levelFromXp(totalXp: number): LevelState {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNext: xpToNextLevel(level) };
}

export function loadoutFromProgress(progress: PlayerProgress): MatchLoadout {
  return {
    level: levelFromXp(progress.xp).level,
    hull: progress.hull,
    cannon: progress.cannon,
    upgrades: { ...progress.upgrades },
  };
}

function multiplier(level: number): number {
  return 1 + UPGRADE_STEP * Math.min(MAX_UPGRADE_LEVEL, Math.max(0, level));
}

export function hullTraits(id: HullId): HullTraits {
  return HULL_CATALOG.find((hull) => hull.id === id)?.traits ?? NEUTRAL_TRAITS;
}

export function applyLoadout(base: GameplayConfig, loadout: MatchLoadout): GameplayConfig {
  const traits = hullTraits(loadout.hull);
  const health = multiplier(loadout.upgrades.health) * traits.health;
  const damage = multiplier(loadout.upgrades.damage) * traits.damage;
  const speed = multiplier(loadout.upgrades.speed) * traits.speed;
  const enemyHealth = 1 + ENEMY_HEALTH_PER_LEVEL * Math.max(0, loadout.level - 1);
  const frontDamage = base.player.frontCannon.damage * damage;
  const frontShot =
    loadout.cannon === 'double'
      ? { projectileCount: 2, sideShots: false, damage: (frontDamage * DOUBLE_CANNON_DAMAGE_MULTIPLIER) / 2 }
      : loadout.cannon === 'broadside'
        ? { projectileCount: 1, sideShots: true, damage: frontDamage * BROADSIDE_CANNON_DAMAGE_MULTIPLIER }
        : { projectileCount: 1, sideShots: false, damage: frontDamage };
  return {
    ...base,
    player: {
      ...base.player,
      maxHealth: Math.round(base.player.maxHealth * health),
      motion: {
        ...base.player.motion,
        maxSpeed: base.player.motion.maxSpeed * speed,
        acceleration: base.player.motion.acceleration * speed,
      },
      frontCannon: {
        ...base.player.frontCannon,
        ...frontShot,
        cooldownSeconds: base.player.frontCannon.cooldownSeconds * traits.cooldown,
      },
      broadside: {
        ...base.player.broadside,
        damage: base.player.broadside.damage * damage,
        cooldownSeconds: base.player.broadside.cooldownSeconds * traits.cooldown,
      },
      regeneration: { ...base.player.regeneration, healthPerSecond: traits.regenerationPerSecond },
    },
    chaser: { ...base.chaser, maxHealth: Math.round(base.chaser.maxHealth * enemyHealth) },
    shooter: { ...base.shooter, maxHealth: Math.round(base.shooter.maxHealth * enemyHealth) },
  };
}

export function rewardsForKills(
  progress: PlayerProgress,
  kills: KillCount,
  loadout: MatchLoadout,
  random: () => number,
): MatchRewards {
  const xp = kills.chaser * XP_REWARD.chaser + kills.shooter * XP_REWARD.shooter;
  const chance = hullTraits(loadout.hull).doubleCoinChance;
  let coins = 0;
  for (let index = 0; index < kills.chaser + kills.shooter; index += 1) {
    coins += COINS_PER_KILL * (chance > 0 && random() < chance ? 2 : 1);
  }
  return {
    coins,
    xp,
    levelBefore: levelFromXp(progress.xp).level,
    levelAfter: levelFromXp(progress.xp + xp).level,
  };
}

export function grantRewards(progress: PlayerProgress, rewards: MatchRewards): PlayerProgress {
  return { ...progress, coins: progress.coins + rewards.coins, xp: progress.xp + rewards.xp };
}

export type PurchaseError = 'owned' | 'maxed' | 'coins';

export type PurchaseResult = { ok: true; progress: PlayerProgress } | { ok: false; reason: PurchaseError };

export function buyHull(progress: PlayerProgress, id: HullId): PurchaseResult {
  const item = HULL_CATALOG.find((hull) => hull.id === id);
  if (!item || progress.ownedHulls.includes(id)) return { ok: false, reason: 'owned' };
  if (progress.coins < item.price) return { ok: false, reason: 'coins' };
  return {
    ok: true,
    progress: { ...progress, coins: progress.coins - item.price, ownedHulls: [...progress.ownedHulls, id], hull: id },
  };
}

export function buyCannon(progress: PlayerProgress, id: CannonId): PurchaseResult {
  const item = CANNON_CATALOG.find((cannon) => cannon.id === id);
  if (!item || progress.ownedCannons.includes(id)) return { ok: false, reason: 'owned' };
  if (progress.coins < item.price) return { ok: false, reason: 'coins' };
  return {
    ok: true,
    progress: {
      ...progress,
      coins: progress.coins - item.price,
      ownedCannons: [...progress.ownedCannons, id],
      cannon: id,
    },
  };
}

export function buyUpgrade(progress: PlayerProgress, id: UpgradeId): PurchaseResult {
  const item = UPGRADE_CATALOG.find((upgrade) => upgrade.id === id);
  const current = progress.upgrades[id];
  if (!item || current >= MAX_UPGRADE_LEVEL) return { ok: false, reason: 'maxed' };
  const price = item.prices[current] ?? Number.POSITIVE_INFINITY;
  if (progress.coins < price) return { ok: false, reason: 'coins' };
  return {
    ok: true,
    progress: { ...progress, coins: progress.coins - price, upgrades: { ...progress.upgrades, [id]: current + 1 } },
  };
}

export function selectHull(progress: PlayerProgress, id: HullId): PlayerProgress {
  return progress.ownedHulls.includes(id) ? { ...progress, hull: id } : progress;
}

export function selectCannon(progress: PlayerProgress, id: CannonId): PlayerProgress {
  return progress.ownedCannons.includes(id) ? { ...progress, cannon: id } : progress;
}
