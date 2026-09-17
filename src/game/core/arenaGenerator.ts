import { ARENA_COLUMNS, ARENA_ROWS, CELL_SIZE, type ArenaDefinition, type IslandDefinition, type PropPlacement } from './arena';
import { createRandom, type RandomSource } from './rng';

const ROCK_TILES = [49, 50, 51, 65, 66, 67] as const;
const PLANT_TILES = [70, 71, 72, 87, 88] as const;
const EDGE_GAP = 1;
const ISLAND_GAP = 2;
const START_CLEARANCE = 3;

interface IslandShape {
  cols: number;
  rows: number;
}

const SHAPES: readonly IslandShape[] = [
  { cols: 2, rows: 2 },
  { cols: 3, rows: 2 },
  { cols: 2, rows: 3 },
  { cols: 3, rows: 3 },
  { cols: 4, rows: 2 },
  { cols: 2, rows: 4 },
  { cols: 4, rows: 4 },
  { cols: 5, rows: 3 },
  { cols: 3, rows: 5 },
  { cols: 6, rows: 2 },
];

function overlaps(a: IslandDefinition, b: IslandDefinition, gap: number): boolean {
  return (
    a.col < b.col + b.cols + gap &&
    b.col < a.col + a.cols + gap &&
    a.row < b.row + b.rows + gap &&
    b.row < a.row + a.rows + gap
  );
}

function props(random: RandomSource, shape: IslandShape): PropPlacement[] {
  const placements: PropPlacement[] = [];
  const count = Math.min(3, Math.max(1, Math.floor((shape.cols * shape.rows) / 3)));
  const used = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const col = random.int(0, shape.cols - 1);
    const row = random.int(0, shape.rows - 1);
    const key = `${col}:${row}`;
    if (used.has(key)) continue;
    used.add(key);
    const tile = random.next() < 0.5 ? random.pick(ROCK_TILES) : random.pick(PLANT_TILES);
    if (tile !== undefined) placements.push({ tile, col, row });
  }
  return placements;
}

function waterConnected(islands: readonly IslandDefinition[], startCol: number, startRow: number): boolean {
  const blocked = new Uint8Array(ARENA_COLUMNS * ARENA_ROWS);
  for (const island of islands) {
    for (let row = island.row; row < island.row + island.rows; row += 1) {
      for (let col = island.col; col < island.col + island.cols; col += 1) {
        blocked[row * ARENA_COLUMNS + col] = 1;
      }
    }
  }
  const visited = new Uint8Array(ARENA_COLUMNS * ARENA_ROWS);
  const queue = [startRow * ARENA_COLUMNS + startCol];
  visited[queue[0] ?? 0] = 1;
  let reached = 0;
  let head = 0;
  while (head < queue.length) {
    const current = queue[head] ?? 0;
    head += 1;
    reached += 1;
    const col = current % ARENA_COLUMNS;
    const row = Math.floor(current / ARENA_COLUMNS);
    const neighbours = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ] as const;
    for (const [nextCol, nextRow] of neighbours) {
      if (nextCol < 0 || nextRow < 0 || nextCol >= ARENA_COLUMNS || nextRow >= ARENA_ROWS) continue;
      const index = nextRow * ARENA_COLUMNS + nextCol;
      if (blocked[index] === 1 || visited[index] === 1) continue;
      visited[index] = 1;
      queue.push(index);
    }
  }
  let water = 0;
  for (const cell of blocked) if (cell === 0) water += 1;
  return reached === water;
}

export function generateArena(seed: number): ArenaDefinition {
  const random = createRandom(seed ^ 0x5eed1a7d);
  const startCol = 2;
  const startRow = Math.floor(ARENA_ROWS / 2);
  const startZone: IslandDefinition = {
    col: startCol - START_CLEARANCE,
    row: startRow - START_CLEARANCE,
    cols: START_CLEARANCE * 2 + 1,
    rows: START_CLEARANCE * 2 + 1,
    style: 'sand',
  };
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const target = random.int(5, 8);
    const islands: IslandDefinition[] = [];
    let tries = 0;
    while (islands.length < target && tries < 200) {
      tries += 1;
      const shape = random.pick(SHAPES) ?? SHAPES[0];
      if (!shape) break;
      const candidate: IslandDefinition = {
        col: random.int(EDGE_GAP, ARENA_COLUMNS - EDGE_GAP - shape.cols),
        row: random.int(EDGE_GAP, ARENA_ROWS - EDGE_GAP - shape.rows),
        cols: shape.cols,
        rows: shape.rows,
        style: shape.cols === 4 && shape.rows === 4 ? 'grass' : 'sand',
        props: props(random, shape),
      };
      if (overlaps(candidate, startZone, 0)) continue;
      if (islands.some((island) => overlaps(candidate, island, ISLAND_GAP))) continue;
      islands.push(candidate);
    }
    if (islands.length >= 4 && waterConnected(islands, startCol, startRow)) {
      return {
        id: `arena-${(seed >>> 0).toString(16)}`,
        name: 'Uncharted waters',
        islands,
        playerStart: { x: (startCol + 0.5) * CELL_SIZE, y: (startRow + 0.5) * CELL_SIZE, heading: 0 },
      };
    }
  }
  return {
    id: 'fallback',
    name: 'Open sea',
    islands: [{ col: Math.floor(ARENA_COLUMNS / 2) - 2, row: Math.floor(ARENA_ROWS / 2) - 1, cols: 4, rows: 2, style: 'sand' }],
    playerStart: { x: (startCol + 0.5) * CELL_SIZE, y: (startRow + 0.5) * CELL_SIZE, heading: 0 },
  };
}
