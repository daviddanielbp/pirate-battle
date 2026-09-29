import { describe, expect, it } from 'vitest';
import { DEFAULT_GAMEPLAY_CONFIG } from '@/game/config/gameplayConfig';
import {
  applyLoadout,
  DEFAULT_PROGRESS,
  levelFromXp,
  loadoutFromProgress,
  rewardsForKills,
} from '@/game/progression/progression';

describe('progression', () => {
  it('needs 30 XP for level 2 and 10 more for each following level', () => {
    expect(levelFromXp(29).level).toBe(1);
    expect(levelFromXp(30).level).toBe(2);
    expect(levelFromXp(30 + 39).level).toBe(2);
    expect(levelFromXp(30 + 40).level).toBe(3);
  });

  it('leaves the brief defaults untouched with the starting loadout', () => {
    const config = applyLoadout(DEFAULT_GAMEPLAY_CONFIG, loadoutFromProgress(DEFAULT_PROGRESS));
    expect(config.player.frontCannon.projectileCount).toBe(1);
    expect(config.player.frontCannon.damage).toBe(DEFAULT_GAMEPLAY_CONFIG.player.frontCannon.damage);
    expect(config.player.maxHealth).toBe(DEFAULT_GAMEPLAY_CONFIG.player.maxHealth);
    expect(config.chaser.maxHealth).toBe(DEFAULT_GAMEPLAY_CONFIG.chaser.maxHealth);
  });

  it('never mutates the base config', () => {
    const snapshot = structuredClone(DEFAULT_GAMEPLAY_CONFIG);
    applyLoadout(DEFAULT_GAMEPLAY_CONFIG, {
      level: 5,
      hull: 'red',
      cannon: 'broadside',
      upgrades: { health: 4, damage: 4, speed: 4 },
    });
    expect(DEFAULT_GAMEPLAY_CONFIG).toEqual(snapshot);
  });

  it('grants 1 coin per kill and 1/2 XP per Chaser/Shooter', () => {
    const rewards = rewardsForKills(DEFAULT_PROGRESS, { chaser: 3, shooter: 2 }, loadoutFromProgress(DEFAULT_PROGRESS), () => 0);
    expect(rewards.coins).toBe(5);
    expect(rewards.xp).toBe(3 + 4);
  });
});
