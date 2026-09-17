import { circleRoundedRectPenetration, type ArenaGeometry } from './arena';
import {
  closestPointsBetweenSegments,
  pointToSegmentDistanceSquared,
  segmentToSegmentDistanceSquared,
} from './math';
import { shipBow, shipStern, type Projectile, type Ship } from './entities';

export interface ObstacleContact {
  pushX: number;
  pushY: number;
  depth: number;
}

export function resolveShipObstacles(ship: Ship, geometry: ArenaGeometry): ObstacleContact | null {
  let pushX = 0;
  let pushY = 0;
  let depth = 0;
  const bow = shipBow(ship);
  const stern = shipStern(ship);
  const samples = [bow, { x: ship.x, y: ship.y }, stern];
  for (const rect of geometry.obstacles) {
    let bestX = 0;
    let bestY = 0;
    let bestDepth = 0;
    for (const sample of samples) {
      const hit = circleRoundedRectPenetration(sample.x, sample.y, ship.radius, rect);
      if (hit && hit.depth > bestDepth) {
        bestDepth = hit.depth;
        bestX = hit.x;
        bestY = hit.y;
      }
    }
    if (bestDepth > 0) {
      pushX += bestX * bestDepth;
      pushY += bestY * bestDepth;
      depth = Math.max(depth, bestDepth);
    }
  }
  if (depth === 0) return null;
  ship.x += pushX;
  ship.y += pushY;
  return { pushX, pushY, depth };
}

export function clampShipToArena(ship: Ship, geometry: ArenaGeometry): boolean {
  const extentX = Math.abs(Math.cos(ship.heading)) * ship.halfLength + ship.radius;
  const extentY = Math.abs(Math.sin(ship.heading)) * ship.halfLength + ship.radius;
  const minX = extentX;
  const maxX = geometry.width - extentX;
  const minY = extentY;
  const maxY = geometry.height - extentY;
  let touched = false;
  if (ship.x < minX) {
    ship.x = minX;
    touched = true;
  } else if (ship.x > maxX) {
    ship.x = maxX;
    touched = true;
  }
  if (ship.y < minY) {
    ship.y = minY;
    touched = true;
  } else if (ship.y > maxY) {
    ship.y = maxY;
    touched = true;
  }
  return touched;
}

export function shipsOverlap(a: Ship, b: Ship): boolean {
  const bowA = shipBow(a);
  const sternA = shipStern(a);
  const bowB = shipBow(b);
  const sternB = shipStern(b);
  const minDistance = a.radius + b.radius;
  const distSq = segmentToSegmentDistanceSquared(
    sternA.x,
    sternA.y,
    bowA.x,
    bowA.y,
    sternB.x,
    sternB.y,
    bowB.x,
    bowB.y,
  );
  return distSq < minDistance * minDistance;
}

export function separateShips(a: Ship, b: Ship, weightA: number, weightB: number): void {
  const bowA = shipBow(a);
  const sternA = shipStern(a);
  const bowB = shipBow(b);
  const sternB = shipStern(b);
  const contact = closestPointsBetweenSegments(
    sternA.x,
    sternA.y,
    bowA.x,
    bowA.y,
    sternB.x,
    sternB.y,
    bowB.x,
    bowB.y,
  );
  let dx = contact.bx - contact.ax;
  let dy = contact.by - contact.ay;
  let dist = Math.sqrt(contact.distanceSquared);
  if (dist < 0.001) {
    dx = b.x - a.x;
    dy = b.y - a.y;
    dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
  }
  const overlap = a.radius + b.radius - dist;
  if (overlap <= 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * overlap * weightA;
  a.y -= ny * overlap * weightA;
  b.x += nx * overlap * weightB;
  b.y += ny * overlap * weightB;
}

export function projectileHitsShip(projectile: Projectile, ship: Ship): boolean {
  const bow = shipBow(ship);
  const stern = shipStern(ship);
  const reach = ship.radius + projectile.radius;
  return (
    pointToSegmentDistanceSquared(projectile.x, projectile.y, stern.x, stern.y, bow.x, bow.y) < reach * reach
  );
}

export function segmentClear(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  geometry: ArenaGeometry,
  margin: number,
  samples = 8,
): boolean {
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const rect of geometry.obstacles) {
      if (circleRoundedRectPenetration(x, y, margin, rect)) return false;
    }
  }
  return true;
}
