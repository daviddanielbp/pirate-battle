import { Container, Graphics, Rectangle, Sprite, Texture, TilingSprite, type Renderer, type Spritesheet } from 'pixi.js';
import { CELL_SIZE, type ArenaDefinition, type IslandDefinition } from '../core/arena';
import { GRASS_ISLAND_TILES, SAND_TILES, SHALLOW_TILES, WATER_TILE } from './constants';
import { textureFrom } from '../assets/loader';

type NineSlice = typeof SAND_TILES | typeof SHALLOW_TILES;

function nineSliceTile(set: NineSlice, col: number, row: number, cols: number, rows: number): number {
  const top = row === 0;
  const bottom = row === rows - 1;
  const left = col === 0;
  const right = col === cols - 1;
  if (top && left) return set.topLeft;
  if (top && right) return set.topRight;
  if (bottom && left) return set.bottomLeft;
  if (bottom && right) return set.bottomRight;
  if (top) return set.top;
  if (bottom) return set.bottom;
  if (left) return set.left;
  if (right) return set.right;
  return set.center;
}

function placeTile(target: Container, tiles: Spritesheet, tile: number, x: number, y: number, alpha = 1): Sprite {
  const sprite = new Sprite(textureFrom(tiles, `tile_${tile}`));
  sprite.position.set(x, y);
  sprite.alpha = alpha;
  target.addChild(sprite);
  return sprite;
}

function buildIsland(target: Container, shallows: Container, tiles: Spritesheet, island: IslandDefinition): void {
  const originX = island.col * CELL_SIZE;
  const originY = island.row * CELL_SIZE;
  for (let row = -1; row <= island.rows; row += 1) {
    for (let col = -1; col <= island.cols; col += 1) {
      const tile = nineSliceTile(SHALLOW_TILES, col + 1, row + 1, island.cols + 2, island.rows + 2);
      const sprite = placeTile(shallows, tiles, tile, originX + col * CELL_SIZE, originY + row * CELL_SIZE, 0.4);
      sprite.tint = 0xd8f6ff;
    }
  }
  const useGrassSet = island.style === 'grass' && island.cols === 4 && island.rows === 4;
  for (let row = 0; row < island.rows; row += 1) {
    for (let col = 0; col < island.cols; col += 1) {
      const tile = useGrassSet
        ? (GRASS_ISLAND_TILES[row]?.[col] ?? SAND_TILES.center)
        : nineSliceTile(SAND_TILES, col, row, island.cols, island.rows);
      placeTile(target, tiles, tile, originX + col * CELL_SIZE, originY + row * CELL_SIZE);
    }
  }
  for (const prop of island.props ?? []) {
    placeTile(target, tiles, prop.tile, originX + prop.col * CELL_SIZE, originY + prop.row * CELL_SIZE);
  }
}

const WATER_MARGIN = 2400;

export class ArenaLayer {
  readonly water: TilingSprite;
  readonly shallows = new Container();
  readonly islands = new Container();
  readonly boundary = new Graphics();
  private readonly waterTexture: Texture;

  constructor(renderer: Renderer, tiles: Spritesheet, arena: ArenaDefinition, width: number, height: number) {
    const source = new Sprite(textureFrom(tiles, `tile_${WATER_TILE}`));
    this.waterTexture = renderer.generateTexture({
      target: source,
      frame: new Rectangle(0, 0, CELL_SIZE, CELL_SIZE),
      resolution: 2,
    });
    source.destroy();
    this.water = new TilingSprite({
      texture: this.waterTexture,
      width: width + WATER_MARGIN * 2,
      height: height + WATER_MARGIN * 2,
    });
    this.water.position.set(-WATER_MARGIN, -WATER_MARGIN);
    this.boundary
      .rect(-WATER_MARGIN, -WATER_MARGIN, width + WATER_MARGIN * 2, WATER_MARGIN)
      .rect(-WATER_MARGIN, height, width + WATER_MARGIN * 2, WATER_MARGIN)
      .rect(-WATER_MARGIN, 0, WATER_MARGIN, height)
      .rect(width, 0, WATER_MARGIN, height)
      .fill({ color: 0x06182a, alpha: 0.45 })
      .rect(0, 0, width, height)
      .stroke({ width: 4, color: 0xf7e9c9, alpha: 0.5 });
    for (const island of arena.islands) buildIsland(this.islands, this.shallows, tiles, island);
    this.shallows.cacheAsTexture(true);
    this.islands.cacheAsTexture(true);
  }

  animate(seconds: number): void {
    this.water.tilePosition.set(Math.sin(seconds * 0.35) * 6 + seconds * 4, Math.cos(seconds * 0.28) * 5 + seconds * 2.5);
  }

  destroy(): void {
    this.boundary.destroy();
    this.water.destroy();
    this.shallows.destroy({ children: true });
    this.islands.destroy({ children: true });
    this.waterTexture.destroy(true);
  }
}
