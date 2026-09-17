export interface AtlasSource {
  key: 'ships' | 'tiles' | 'ui';
  json: string;
  image: string;
}

export const ATLAS_SOURCES: readonly AtlasSource[] = [
  { key: 'ships', json: '/assets/game/ships.json', image: '/assets/game/ships.png' },
  { key: 'tiles', json: '/assets/game/tiles.json', image: '/assets/game/tiles.png' },
  { key: 'ui', json: '/assets/game/ui.json', image: '/assets/game/ui.png' },
];

export const SOUND_SOURCES = {
  cannonFire1: '/assets/audio/cannon_fire_1.m4a',
  cannonFire2: '/assets/audio/cannon_fire_2.m4a',
  cannonFire3: '/assets/audio/cannon_fire_3.m4a',
  cannonBroadside: '/assets/audio/cannon_broadside.m4a',
  waterHit1: '/assets/audio/cannonball_water_hit_1.m4a',
  waterHit2: '/assets/audio/cannonball_water_hit_2.m4a',
  woodHit1: '/assets/audio/ship_wood_hit_1.m4a',
  woodHit2: '/assets/audio/ship_wood_hit_2.m4a',
  shipCollision: '/assets/audio/ship_collision.m4a',
  shipExplosion1: '/assets/audio/ship_explosion_1.m4a',
  shipExplosion2: '/assets/audio/ship_explosion_2.m4a',
  shipSinking: '/assets/audio/ship_sinking.m4a',
  scorePoint: '/assets/audio/score_point.m4a',
  healthLow: '/assets/audio/health_low.m4a',
  timeWarning: '/assets/audio/time_warning.m4a',
  gameStart: '/assets/audio/game_start.m4a',
  gameOver: '/assets/audio/game_over.m4a',
  gameComplete: '/assets/audio/game_complete.m4a',
  gamePause: '/assets/audio/game_pause.m4a',
  gameResume: '/assets/audio/game_resume.m4a',
  uiClick: '/assets/audio/ui_click.m4a',
  uiHover: '/assets/audio/ui_hover.m4a',
  uiOpen: '/assets/audio/ui_open.m4a',
  uiClose: '/assets/audio/ui_close.m4a',
  uiBack: '/assets/audio/ui_back.m4a',
  oceanLoop: '/assets/audio/ocean_ambience_loop.m4a',
  sailingLoop: '/assets/audio/ship_sailing_loop.m4a',
} as const;

export type SoundName = keyof typeof SOUND_SOURCES;
