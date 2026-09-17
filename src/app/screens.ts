import type { MatchSession } from './matchSession';

export type LogTab = 'ranking' | 'history';

export type Screen =
  | { name: 'menu' }
  | { name: 'options' }
  | { name: 'shipyard' }
  | { name: 'log'; tab: LogTab }
  | { name: 'loading'; session: MatchSession }
  | { name: 'battle'; session: MatchSession }
  | { name: 'result' };

export type ScreenAction =
  | { type: 'menu' }
  | { type: 'options' }
  | { type: 'shipyard' }
  | { type: 'log'; tab: LogTab }
  | { type: 'prepare'; session: MatchSession }
  | { type: 'battle'; session: MatchSession }
  | { type: 'result' };

export function screenReducer(_state: Screen, action: ScreenAction): Screen {
  switch (action.type) {
    case 'menu':
      return { name: 'menu' };
    case 'options':
      return { name: 'options' };
    case 'shipyard':
      return { name: 'shipyard' };
    case 'log':
      return { name: 'log', tab: action.tab };
    case 'prepare':
      return { name: 'loading', session: action.session };
    case 'battle':
      return { name: 'battle', session: action.session };
    case 'result':
      return { name: 'result' };
  }
}
