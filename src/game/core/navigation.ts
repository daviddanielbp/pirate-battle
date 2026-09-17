import { CELL_SIZE, pointInsideObstacle, type ArenaGeometry } from './arena';

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class NavigationGrid {
  readonly columns: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly distances: Int32Array;
  private targetCell = -1;

  constructor(geometry: ArenaGeometry, clearance: number) {
    this.columns = Math.ceil(geometry.width / CELL_SIZE);
    this.rows = Math.ceil(geometry.height / CELL_SIZE);
    this.blocked = new Uint8Array(this.columns * this.rows);
    this.distances = new Int32Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const center = this.cellCenter(column, row);
        if (pointInsideObstacle(center.x, center.y, geometry.obstacles, clearance)) {
          this.blocked[row * this.columns + column] = 1;
        }
      }
    }
  }

  cellOf(x: number, y: number): number {
    const column = Math.min(this.columns - 1, Math.max(0, Math.floor(x / CELL_SIZE)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL_SIZE)));
    return row * this.columns + column;
  }

  cellCenter(column: number, row: number): { x: number; y: number } {
    return { x: (column + 0.5) * CELL_SIZE, y: (row + 0.5) * CELL_SIZE };
  }

  updateTarget(x: number, y: number): void {
    const cell = this.cellOf(x, y);
    if (cell === this.targetCell) return;
    this.targetCell = cell;
    this.distances.fill(-1);
    this.distances[cell] = 0;
    const queue: number[] = [cell];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head] ?? cell;
      head += 1;
      const column = current % this.columns;
      const row = Math.floor(current / this.columns);
      const distance = this.distances[current] ?? 0;
      for (const [dc, dr] of NEIGHBOURS) {
        const nextColumn = column + dc;
        const nextRow = row + dr;
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= this.columns || nextRow >= this.rows) continue;
        const next = nextRow * this.columns + nextColumn;
        if (this.blocked[next] === 1 || this.distances[next] !== -1) continue;
        this.distances[next] = distance + 1;
        queue.push(next);
      }
    }
  }

  nextWaypoint(x: number, y: number): { x: number; y: number } | null {
    const cell = this.cellOf(x, y);
    const own = this.distances[cell];
    if (own === undefined || own <= 0) return null;
    const column = cell % this.columns;
    const row = Math.floor(cell / this.columns);
    let best: number | null = null;
    let bestDistance = own;
    for (const [dc, dr] of NEIGHBOURS) {
      const nextColumn = column + dc;
      const nextRow = row + dr;
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= this.columns || nextRow >= this.rows) continue;
      const next = nextRow * this.columns + nextColumn;
      const candidate = this.distances[next];
      if (candidate === undefined || candidate < 0 || candidate >= bestDistance) continue;
      bestDistance = candidate;
      best = next;
    }
    if (best === null) return null;
    return this.cellCenter(best % this.columns, Math.floor(best / this.columns));
  }
}
