import { UI_ASSET_BASE } from '@/ui/shared/assetUrls';

const CONTROL_ICON_FILES = {
  close: 'icon_close',
  fireFront: 'icon_fire_front',
  fireLeft: 'icon_fire_left',
  fireRight: 'icon_fire_right',
  forward: 'icon_forward',
  home: 'icon_home',
  minus: 'icon_minus',
  pause: 'icon_pause',
  play: 'icon_play',
  plus: 'icon_plus',
  restart: 'icon_restart',
  settings: 'icon_settings',
  turnLeft: 'icon_turn_left',
  turnRight: 'icon_turn_right',
} as const;

export type IconName = keyof typeof CONTROL_ICON_FILES;

export const ICON_NAMES = Object.keys(CONTROL_ICON_FILES) as IconName[];

export function iconUrl(name: IconName): string {
  return `${UI_ASSET_BASE}/controls/${CONTROL_ICON_FILES[name]}.png`;
}
