import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/data/queryClient';
import { flushPending } from '@/data/submissionManager';
import type { EndReason } from '@/game/core/entities';
import { getPlayerOptions } from '@/storage/optionsStore';
import { getPlayerProgress, savePlayerProgress } from '@/storage/progressStore';
import { saveLastRewards } from '@/storage/lastRewardsStore';
import { grantRewards, loadoutFromProgress, rewardsForKills, type KillCount } from '@/game/progression/progression';
import { createRandom } from '@/game/core/rng';
import { loadPlayerIdentity } from '@/storage/playerIdentity';
import {
  rememberResultScreen,
  saveLastResult,
  wasResultScreenOpen,
  getLastResult,
} from '@/storage/lastResultStore';
import { enqueue } from '@/data/pendingSubmissions';
import { submitPending } from '@/data/submissionManager';
import { installTestApi, reportScreen } from '@/testing/instrumentation';
import { nextMatchSeed, readRuntimeFlags } from '@/testing/flags';
import { TEST_IDS } from '@/testing/testIds';
import { AudioProvider } from './AudioProvider';
import { ToastProvider } from '@/ui/organisms/ToastProvider';
import { LanguageProvider } from './LanguageProvider';
import { buildMatchRecord, createMatchSession, type MatchSession } from './matchSession';
import { screenReducer, type Screen } from './screens';
import { LogScreen } from '@/ui/pages/LogScreen';
import { MenuScreen } from '@/ui/pages/MenuScreen';
import { OptionsScreen } from '@/ui/pages/OptionsScreen';
import { ResultScreen } from '@/ui/pages/ResultScreen';
import { ShipyardScreen } from '@/ui/pages/ShipyardScreen';

// PixiJS is only needed once a battle is being prepared, so the loading and battle
// screens are split out of the initial bundle and fetched when the player presses Play.
// They are prefetched right after the menu renders, so pressing Play doesn't wait for the download.
const loadLoadingScreen = () => import('@/ui/pages/LoadingScreen');
const loadBattleScreen = () => import('@/ui/pages/BattleScreen');
const LoadingScreen = lazy(() => loadLoadingScreen().then((module) => ({ default: module.LoadingScreen })));
const BattleScreen = lazy(() => loadBattleScreen().then((module) => ({ default: module.BattleScreen })));

const flags = readRuntimeFlags();
if (flags.instrumentation) installTestApi();

function initialScreen(): Screen {
  return wasResultScreenOpen() && getLastResult() ? { name: 'result' } : { name: 'menu' };
}

export function App(): React.JSX.Element {
  const [screen, dispatch] = useReducer(screenReducer, undefined, initialScreen);
  const [player] = useState(() => loadPlayerIdentity());
  const matchCounter = useRef(0);

  useEffect(() => {
    void flushPending();
    void Promise.all([loadLoadingScreen(), loadBattleScreen()]).catch(() => undefined);
  }, []);

  useEffect(() => {
    reportScreen(screen.name);
    rememberResultScreen(screen.name === 'result');
  }, [screen]);

  const startMatch = useCallback(() => {
    matchCounter.current += 1;
    const session = createMatchSession(
      getPlayerOptions(),
      loadoutFromProgress(getPlayerProgress()),
      nextMatchSeed(flags.seed, matchCounter.current),
    );
    dispatch({ type: 'prepare', session });
  }, []);

  const finishMatch = useCallback(
    (session: MatchSession, outcome: { score: number; elapsedSeconds: number; endReason: EndReason; kills: KillCount }) => {
      const record = buildMatchRecord(session, player, outcome);
      const progress = getPlayerProgress();
      const random = createRandom(session.seed ^ 0x51ee7);
      const rewards = rewardsForKills(progress, outcome.kills, session.loadout, () => random.next());
      savePlayerProgress(grantRewards(progress, rewards));
      saveLastRewards({ ...rewards, matchId: record.id });
      saveLastResult(record);
      enqueue(record);
      void submitPending(record.id);
    },
    [player],
  );

  const showResult = useCallback(() => dispatch({ type: 'result' }), []);

  const goToMenu = useCallback(() => dispatch({ type: 'menu' }), []);

  const content = useMemo(() => {
    switch (screen.name) {
      case 'menu':
        return (
          <MenuScreen
            onPlay={startMatch}
            onOptions={() => dispatch({ type: 'options' })}
            onShipyard={() => dispatch({ type: 'shipyard' })}
            onOpenLog={(tab) => dispatch({ type: 'log', tab })}
          />
        );
      case 'options':
        return <OptionsScreen onBack={goToMenu} />;
      case 'shipyard':
        return <ShipyardScreen onBack={goToMenu} />;
      case 'log':
        return <LogScreen initialTab={screen.tab} player={player} onBack={goToMenu} />;
      case 'loading':
        return (
          <LoadingScreen
            session={screen.session}
            onReady={() => dispatch({ type: 'battle', session: screen.session })}
            onBack={goToMenu}
          />
        );
      case 'battle':
        return (
          <BattleScreen
            key={screen.session.id}
            session={screen.session}
            clock={flags.clock}
            forceTouch={flags.touch}
            onEnded={(outcome) => finishMatch(screen.session, outcome)}
            onShowResult={showResult}
            onAbandon={goToMenu}
          />
        );
      case 'result':
        return (
          <ResultScreen
            onPlayAgain={startMatch}
            onMainMenu={goToMenu}
            onShipyard={() => dispatch({ type: 'shipyard' })}
          />
        );
    }
  }, [screen, startMatch, finishMatch, showResult, goToMenu, player]);

  return (
    <QueryClientProvider client={queryClient}>
      <AudioProvider>
        <LanguageProvider>
          <ToastProvider>
            <div data-testid={TEST_IDS.app} className="pb-app">
              <Suspense fallback={null}>{content}</Suspense>
            </div>
          </ToastProvider>
        </LanguageProvider>
      </AudioProvider>
    </QueryClientProvider>
  );
}
