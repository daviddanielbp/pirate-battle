import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const source = join(root, 'assets');
const target = join(root, 'public', 'assets');

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

interface Atlas {
  frames: Record<string, AtlasFrame>;
  meta: { image: string; format: string; size: { w: number; h: number }; scale: string };
}

function frame(x: number, y: number, w: number, h: number): AtlasFrame {
  return {
    frame: { x, y, w, h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
  };
}

function buildShips(): void {
  const xml = readFileSync(join(source, 'spritesheet', 'ships_miscellaneous_sheet.xml'), 'utf8');
  const frames: Record<string, AtlasFrame> = {};
  const pattern = /<SubTexture name="([^"]+)\.png" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g;
  for (const match of xml.matchAll(pattern)) {
    const [, name, x, y, w, h] = match;
    if (!name || !x || !y || !w || !h) continue;
    frames[name] = frame(Number(x), Number(y), Number(w), Number(h));
  }
  const atlas: Atlas = {
    frames,
    meta: { image: 'ships.png', format: 'RGBA8888', size: { w: 1024, h: 512 }, scale: '1' },
  };
  cpSync(join(source, 'spritesheet', 'ships_miscellaneous_sheet.png'), join(target, 'game', 'ships.png'));
  writeFileSync(join(target, 'game', 'ships.json'), JSON.stringify(atlas));
}

function buildTiles(): void {
  const columns = 16;
  const rows = 6;
  const size = 128;
  const frames: Record<string, AtlasFrame> = {};
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column + 1;
      frames[`tile_${index}`] = frame(column * size, row * size, size, size);
    }
  }
  const atlas: Atlas = {
    frames,
    meta: { image: 'tiles.png', format: 'RGBA8888', size: { w: columns * size, h: rows * size }, scale: '2' },
  };
  cpSync(join(source, 'tilesheet', 'tiles_sheet_retina.png'), join(target, 'game', 'tiles.png'));
  writeFileSync(join(target, 'game', 'tiles.json'), JSON.stringify(atlas));
}

function buildUiAtlas(): void {
  const raw = JSON.parse(readFileSync(join(source, 'spritesheet', 'ui_sheet_retina.json'), 'utf8')) as Atlas;
  const frames: Record<string, AtlasFrame> = {};
  for (const [name, data] of Object.entries(raw.frames)) {
    frames[name] = {
      frame: data.frame,
      rotated: data.rotated,
      trimmed: data.trimmed,
      spriteSourceSize: data.spriteSourceSize,
      sourceSize: data.sourceSize,
    };
  }
  const atlas: Atlas = {
    frames,
    meta: { image: 'ui.png', format: 'RGBA8888', size: raw.meta.size, scale: raw.meta.scale },
  };
  cpSync(join(source, 'spritesheet', 'ui_sheet_retina.png'), join(target, 'game', 'ui.png'));
  writeFileSync(join(target, 'game', 'ui.json'), JSON.stringify(atlas));
}

function copyMenuImages(): void {
  cpSync(join(source, 'png', 'retina', 'ui'), join(target, 'ui'), { recursive: true });
  cpSync(join(source, 'ui_scene_background.png'), join(target, 'ui', 'scene_background.png'));
  cpSync(join(source, 'png', 'default', 'ships', 'ship_2.png'), join(target, 'ui', 'ship_player.png'));
}

function convertSounds(): void {
  const soundsDir = join(source, 'sounds');
  const output = join(target, 'audio');
  mkdirSync(output, { recursive: true });
  let converter: 'afconvert' | 'ffmpeg' | null = null;
  for (const candidate of ['afconvert', 'ffmpeg'] as const) {
    try {
      execFileSync('which', [candidate], { stdio: 'ignore' });
      converter = candidate;
      break;
    } catch {
      continue;
    }
  }
  for (const file of readdirSync(soundsDir)) {
    if (!file.endsWith('.wav')) continue;
    const name = file.replace(/\.wav$/, '');
    const input = join(soundsDir, file);
    if (converter === 'afconvert') {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', input, join(output, `${name}.m4a`)]);
    } else if (converter === 'ffmpeg') {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-c:a', 'aac', '-b:a', '96k', join(output, `${name}.m4a`)]);
    } else {
      cpSync(input, join(output, file));
    }
  }
  if (!converter) {
    console.warn('No audio converter found; WAV files were copied without compression.');
  }
}

if (existsSync(target)) rmSync(target, { recursive: true });
mkdirSync(join(target, 'game'), { recursive: true });
buildShips();
buildTiles();
buildUiAtlas();
copyMenuImages();
convertSounds();
console.log(`Assets written to ${target}`);
