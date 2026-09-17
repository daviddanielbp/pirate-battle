export const TWO_PI = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function wrapAngle(angle: number): number {
  let wrapped = angle % TWO_PI;
  if (wrapped > Math.PI) wrapped -= TWO_PI;
  if (wrapped < -Math.PI) wrapped += TWO_PI;
  return wrapped;
}

export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

export function rotateTowards(current: number, target: number, maxStep: number): number {
  const delta = angleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return target;
  return wrapAngle(current + Math.sign(delta) * maxStep);
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(distanceSquared(ax, ay, bx, by));
}

export function pointToSegmentDistanceSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return distanceSquared(px, py, ax, ay);
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / lengthSquared, 0, 1);
  return distanceSquared(px, py, ax + abx * t, ay + aby * t);
}

export interface SegmentContact {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  distanceSquared: number;
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return { x: ax, y: ay };
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / lengthSquared, 0, 1);
  return { x: ax + abx * t, y: ay + aby * t };
}

export function closestPointsBetweenSegments(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): SegmentContact {
  const pairs: readonly (readonly [{ x: number; y: number }, { x: number; y: number }])[] = [
    [{ x: ax, y: ay }, closestPointOnSegment(ax, ay, cx, cy, dx, dy)],
    [{ x: bx, y: by }, closestPointOnSegment(bx, by, cx, cy, dx, dy)],
    [closestPointOnSegment(cx, cy, ax, ay, bx, by), { x: cx, y: cy }],
    [closestPointOnSegment(dx, dy, ax, ay, bx, by), { x: dx, y: dy }],
  ];
  let best: SegmentContact = { ax, ay, bx: cx, by: cy, distanceSquared: Number.POSITIVE_INFINITY };
  for (const [first, second] of pairs) {
    const distSq = distanceSquared(first.x, first.y, second.x, second.y);
    if (distSq < best.distanceSquared) {
      best = { ax: first.x, ay: first.y, bx: second.x, by: second.y, distanceSquared: distSq };
    }
  }
  return best;
}

export function segmentToSegmentDistanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  const candidates = [
    pointToSegmentDistanceSquared(ax, ay, cx, cy, dx, dy),
    pointToSegmentDistanceSquared(bx, by, cx, cy, dx, dy),
    pointToSegmentDistanceSquared(cx, cy, ax, ay, bx, by),
    pointToSegmentDistanceSquared(dx, dy, ax, ay, bx, by),
  ];
  let best = candidates[0] ?? 0;
  for (const candidate of candidates) if (candidate < best) best = candidate;
  return best;
}
