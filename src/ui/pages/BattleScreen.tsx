import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppAudio } from '@/app/audioContext';
import { useTranslation } from '@/app/useTranslation';
import type { MatchSession } from '@/app/matchSession';
import { COARSE_POINTER_QUERY, PORTRAIT_PHONE_QUERY, useMediaQuery } from '@/app/useMediaQuery';
import { BattleRuntime, type ClockMode, type HudSnapshot } from '@/game/battleRuntime';
import { getLoadedAtlases } from '@/game/assets/loader';
import type { EndReason } from '@/game/core/entities';
import { attachKeyboard } from '@/game/input/keyboard';
import { attachPointerSteering } from '@/game/input/pointerSteering';
import { HULL_SPRITE_INDEX, type KillCount } from '@/game/progression/progression';
import type { Translate } from '@/i18n';
import { registerBattleRuntime } from '@/testing/instrumentation';
import { TEST_IDS } from '@/testing/testIds';
import { Button, Panel, StatusMessage } from '@/ui';
import { Hud } from '@/ui/organisms/Hud';
import { PauseDialog } from '@/ui/organisms/PauseDialog';
import { TouchControls } from '@/ui/organisms/TouchControls';
import './BattleScreen.css';

export interface BattleOutcome {
  score: number;
  elapsedSeconds: number;
  endReason: EndReason;
  kills: KillCount;
}

export interface BattleScreenProps {
  session: MatchSession;
  clock: ClockMode;
  forceTouch: boolean;
  onEnded: (outcome: BattleOutcome) => void;
  onShowResult: () => void;
  onAbandon: () => void;
}

const IDLE_SNAPSHOT: HudSnapshot = {
  status: 'booting',
  pauseReason: null,
  score: 0,
  secondsLeft: 0,
  elapsedSeconds: 0,
  health: 0,
  maxHealth: 0,
  enemyCount: 0,
  endReason: null,
  kills: { chaser: 0, shooter: 0 },
};

const RESULT_DELAY_MS = 900;

const noopSubscribe = (): (() => void) => () => undefined;
const idleSnapshot = (): HudSnapshot => IDLE_SNAPSHOT;

export function BattleScreen({ session, clock, forceTouch, onEnded, onShowResult, onAbandon }: BattleScreenProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [runtime, setRuntime] = useState<BattleRuntime | null>(null);
  const [failure, setFailure] = useState(false);
  const endedRef = useRef(onEnded);
  const showResultRef = useRef(onShowResult);
  const abandonRef = useRef(onAbandon);
  const recordedRef = useRef(false);
  const { engine } = useAppAudio();
  const { t } = useTranslation();
  const coarsePointer = useMediaQuery(COARSE_POINTER_QUERY);
  const portraitPhone = useMediaQuery(PORTRAIT_PHONE_QUERY);

  useEffect(() => {
    endedRef.current = onEnded;
    showResultRef.current = onShowResult;
    abandonRef.current = onAbandon;
  }, [onEnded, onShowResult, onAbandon]);

  useEffect(() => {
    const host = hostRef.current;
    const atlases = getLoadedAtlases();
    if (!host || !atlases) {
      setFailure(true);
      return;
    }
    recordedRef.current = false;
    const instance = new BattleRuntime({
      host,
      atlases,
      config: session.config,
      arena: session.arena,
      seed: session.seed,
      clock,
      audio: engine,
      appearance: { playerSpriteIndex: HULL_SPRITE_INDEX[session.loadout.hull] },
    });
    let active = true;
    instance
      .start()
      .then(() => {
        if (active) setRuntime(instance);
      })
      .catch(() => {
        if (active) setFailure(true);
      });
    registerBattleRuntime(instance);
    const isActive = (): boolean => instance.getSnapshot().status === 'running';
    const detachKeyboard = attachKeyboard({
      target: window,
      state: instance.controls,
      isActive,
      onPause: () => instance.pause('manual'),
      ignoreTurns: session.steering === 'mouse',
    });
    const detachPointer =
      session.steering === 'mouse'
        ? attachPointerSteering({
            surface: host,
            state: instance.controls,
            isActive,
            toArenaPoint: (clientX, clientY) => instance.toArenaPoint(clientX, clientY),
            playerPosition: () => ({ x: instance.simulation.player.x, y: instance.simulation.player.y }),
          })
        : () => undefined;
    return () => {
      active = false;
      detachKeyboard();
      detachPointer();
      registerBattleRuntime(null);
      instance.destroy();
      setRuntime(null);
    };
  }, [session, clock, engine]);

  const snapshot = useSyncExternalStore(
    runtime?.subscribe ?? noopSubscribe,
    runtime?.getSnapshot ?? idleSnapshot,
    idleSnapshot,
  );

  useEffect(() => {
    if (!runtime || snapshot.status !== 'ended' || !snapshot.endReason) return;
    if (!recordedRef.current) {
      recordedRef.current = true;
      endedRef.current({
        score: snapshot.score,
        elapsedSeconds: snapshot.elapsedSeconds,
        endReason: snapshot.endReason,
        kills: snapshot.kills,
      });
    }
    const timer = window.setTimeout(() => showResultRef.current(), RESULT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [runtime, snapshot]);

  useEffect(() => {
    if (portraitPhone && runtime) runtime.pause('manual');
  }, [portraitPhone, runtime]);

  const pause = useCallback(() => runtime?.pause('manual'), [runtime]);
  const resume = useCallback(() => runtime?.resume(), [runtime]);
  const announcement = describeBattlePhase(t, snapshot);

  const showTouch = forceTouch || coarsePointer;

  return (
    <div className="battle" data-testid={TEST_IDS.screenBattle}>
      <div ref={hostRef} className="battle-host" data-testid={TEST_IDS.battleCanvas} />
      {runtime && <Hud snapshot={snapshot} announcement={announcement} onPause={pause} />}
      {runtime && showTouch && (
        <TouchControls controls={runtime.controls} disabled={snapshot.status !== 'running'} />
      )}
      {runtime && (
        <PauseDialog
          open={snapshot.status === 'paused' && !portraitPhone}
          reason={snapshot.pauseReason}
          onResume={resume}
          onAbandon={() => abandonRef.current()}
        />
      )}
      {portraitPhone && (
        <div className="battle-orientation" role="alert" data-testid={TEST_IDS.orientationHint}>
          <Panel size="compact" title={t('battle.rotateTitle')}>
            <p className="battle-orientation-copy">{t('battle.rotateCopy')}</p>
            <Button variant="secondary" size="small" onClick={() => abandonRef.current()}>
              {t('common.mainMenu')}
            </Button>
          </Panel>
        </div>
      )}
      {failure && (
        <div className="battle-orientation" role="alert">
          <Panel size="compact" title={t('battle.unavailableTitle')}>
            <StatusMessage tone="danger">{t('battle.unavailableCopy')}</StatusMessage>
            <Button onClick={() => abandonRef.current()}>{t('common.mainMenu')}</Button>
          </Panel>
        </div>
      )}
    </div>
  );
}

function describeBattlePhase(t: Translate, snapshot: HudSnapshot): string {
  if (snapshot.status === 'paused') return t('battle.paused');
  if (snapshot.status === 'ended') {
    return t(snapshot.endReason === 'time_up' ? 'battle.timeUp' : 'battle.sunk', { score: snapshot.score });
  }
  if (snapshot.status !== 'running') return '';
  if (snapshot.secondsLeft <= 10) return t('battle.tenSeconds');
  if (snapshot.secondsLeft <= 30) return t('battle.thirtySeconds');
  return t('battle.inProgress');
}
