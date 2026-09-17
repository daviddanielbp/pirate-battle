import { HULL_SPRITE_INDEX, type HullId } from '@/game/progression/progression';
import './HullSprite.css';

export interface HullSpriteProps {
  hull: HullId;
  scale?: number | undefined;
  className?: string | undefined;
}

interface SpriteFrame {
  x: number;
  y: number;
}

const SHEET_WIDTH = 1024;
const SHEET_HEIGHT = 512;
const FRAME_WIDTH = 66;
const FRAME_HEIGHT = 113;

const FRAMES: readonly SpriteFrame[] = [
  { x: 408, y: 0 },
  { x: 408, y: 115 },
  { x: 204, y: 115 },
  { x: 68, y: 192 },
  { x: 68, y: 77 },
  { x: 68, y: 307 },
];

export function HullSprite({ hull, scale = 0.6, className }: HullSpriteProps): React.JSX.Element {
  const frame = FRAMES[HULL_SPRITE_INDEX[hull] - 1] ?? { x: 0, y: 0 };
  return (
    <span
      className={className ? `pb-hull-sprite ${className}` : 'pb-hull-sprite'}
      aria-hidden="true"
      style={{
        width: `${FRAME_WIDTH * scale}px`,
        height: `${FRAME_HEIGHT * scale}px`,
        backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
        backgroundSize: `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`,
      }}
    />
  );
}
