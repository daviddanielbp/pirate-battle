import { pointInsideArena, pointInsideObstacle, type ArenaGeometry } from './arena';
import { wrapAngle } from './math';
import type { Ship } from './entities';

const CANDIDATE_OFFSETS = [
  0,
  0.35,
  -0.35,
  0.7,
  -0.7,
  1.05,
  -1.05,
  1.4,
  -1.4,
  1.8,
  -1.8,
  2.2,
  -2.2,
  2.7,
  -2.7,
  Math.PI,
];
const LOOKAHEAD_STEPS = [48, 96, 150];

export function findClearHeading(
  ship: Ship,
  desired: number,
  geometry: ArenaGeometry,
  targetDistance = Number.POSITIVE_INFINITY,
): number {
  const margin = ship.radius + 10;
  const reach = Math.max(0, targetDistance - ship.halfLength);
  for (const offset of CANDIDATE_OFFSETS) {
    const heading = wrapAngle(desired + offset);
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    let clear = true;
    for (const step of LOOKAHEAD_STEPS) {
      const probe = Math.min(step, reach);
      const px = ship.x + cos * (ship.halfLength + probe);
      const py = ship.y + sin * (ship.halfLength + probe);
      if (
        !pointInsideArena(px, py, geometry, ship.radius + 6) ||
        pointInsideObstacle(px, py, geometry.obstacles, margin)
      ) {
        clear = false;
        break;
      }
      if (probe < step) break;
    }
    if (clear) return heading;
  }
  return desired;
}

export function separationHeadingBias(
  ship: Ship,
  others: readonly Ship[],
  radius: number,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const other of others) {
    if (other === ship) continue;
    const dx = ship.x - other.x;
    const dy = ship.y - other.y;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0 || distSq > radius * radius) continue;
    const dist = Math.sqrt(distSq);
    const strength = (radius - dist) / radius;
    x += (dx / dist) * strength;
    y += (dy / dist) * strength;
  }
  return { x, y };
}
