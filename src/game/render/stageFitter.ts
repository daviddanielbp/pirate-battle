import type { Application, Container } from 'pixi.js';

export interface StageFit {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotated: boolean;
}

export function fitWorld(app: Application, world: Container, arenaWidth: number, arenaHeight: number): StageFit {
  const width = Math.max(1, app.renderer.width);
  const height = Math.max(1, app.renderer.height);
  const rotated = height > width && arenaWidth > arenaHeight;
  const visibleWidth = rotated ? arenaHeight : arenaWidth;
  const visibleHeight = rotated ? arenaWidth : arenaHeight;
  const scale = Math.min(width / visibleWidth, height / visibleHeight);
  const offsetX = (width - visibleWidth * scale) / 2;
  const offsetY = (height - visibleHeight * scale) / 2;
  world.scale.set(scale);
  world.rotation = rotated ? Math.PI / 2 : 0;
  world.position.set(rotated ? offsetX + arenaHeight * scale : offsetX, offsetY);
  return { scale, offsetX, offsetY, width, height, rotated };
}
