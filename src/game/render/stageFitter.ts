import type { Application } from 'pixi.js';

export interface StageFit {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function fitStage(app: Application, arenaWidth: number, arenaHeight: number): StageFit {
  const width = Math.max(1, app.renderer.width);
  const height = Math.max(1, app.renderer.height);
  const scale = Math.min(width / arenaWidth, height / arenaHeight);
  const offsetX = (width - arenaWidth * scale) / 2;
  const offsetY = (height - arenaHeight * scale) / 2;
  app.stage.scale.set(scale);
  app.stage.position.set(offsetX, offsetY);
  return { scale, offsetX, offsetY, width, height };
}
