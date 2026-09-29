import { describe, expect, it } from 'vitest';
import { ARENA_COLUMNS, ARENA_ROWS } from '@/game/core/arena';
import { generateArena } from '@/game/core/arenaGenerator';

const SEEDS = Array.from({ length: 200 }, (_, index) => (index * 2654435761) >>> 0);

describe('generateArena', () => {
  it('is a pure function of the seed', () => {
    expect(generateArena(42)).toEqual(generateArena(42));
    expect(generateArena(42)).not.toEqual(generateArena(43));
  });

  it.each(SEEDS)('seed %i keeps islands inside the grid and away from the start', (seed) => {
    const arena = generateArena(seed);
    expect(arena.islands.length).toBeGreaterThanOrEqual(1);
    const startCol = Math.floor(arena.playerStart.x / 64);
    const startRow = Math.floor(arena.playerStart.y / 64);
    for (const island of arena.islands) {
      expect(island.col).toBeGreaterThanOrEqual(0);
      expect(island.row).toBeGreaterThanOrEqual(0);
      expect(island.col + island.cols).toBeLessThanOrEqual(ARENA_COLUMNS);
      expect(island.row + island.rows).toBeLessThanOrEqual(ARENA_ROWS);
      const coversStart =
        startCol >= island.col &&
        startCol < island.col + island.cols &&
        startRow >= island.row &&
        startRow < island.row + island.rows;
      expect(coversStart).toBe(false);
    }
  });
});
