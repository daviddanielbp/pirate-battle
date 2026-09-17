import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchSession } from '@/app/matchSession';
import { useAppAudio } from '@/app/audioContext';
import { useTranslation } from '@/app/useTranslation';
import { GAME_SOUNDS } from '@/game/audio/audioEngine';
import { AssetLoadError, loadGameAtlases, type LoadProgress } from '@/game/assets/loader';
import { TEST_IDS } from '@/testing/testIds';
import type { Translate } from '@/i18n';
import { Button, Panel, ProgressBar, ScreenTemplate, StatusMessage } from '@/ui';
import './LoadingScreen.css';

export interface LoadingScreenProps {
  session: MatchSession;
  onReady: () => void;
  onBack: () => void;
}

type LoadState =
  | { phase: 'loading'; progress: LoadProgress }
  | { phase: 'error'; asset: string | null }
  | { phase: 'ready' };

const INITIAL_STATE: LoadState = {
  phase: 'loading',
  progress: { completed: 0, total: 1, ratio: 0, current: 'Preparing' },
};

export function LoadingScreen({ session, onReady, onBack }: LoadingScreenProps): React.JSX.Element {
  const [state, setState] = useState<LoadState>(INITIAL_STATE);
  const [attempt, setAttempt] = useState(0);
  const { engine } = useAppAudio();
  const { t } = useTranslation();
  const readyRef = useRef(onReady);

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    loadGameAtlases((progress) => {
      if (!cancelled) setState({ phase: 'loading', progress });
    })
      .then(() => {
        if (cancelled) return;
        engine.preload(GAME_SOUNDS);
        setState({ phase: 'ready' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ phase: 'error', asset: error instanceof AssetLoadError ? error.url : null });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, engine, session.id]);

  useEffect(() => {
    if (state.phase !== 'ready') return;
    const timer = window.setTimeout(() => readyRef.current(), 350);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const retry = useCallback(() => {
    setState(INITIAL_STATE);
    setAttempt((value) => value + 1);
  }, []);

  return (
    <ScreenTemplate testId={TEST_IDS.screenLoading}>
      <Panel size="compact" title={t('loading.title')} headingLevel={1}>
        {state.phase === 'error' ? (
          <div className="pb-stack loading-stack">
            <StatusMessage tone="danger" testId={TEST_IDS.loadingError}>
              {describeLoadError(t, state.asset)} {t('loading.checkConnection')}
            </StatusMessage>
            <Button testId={TEST_IDS.loadingRetry} onClick={retry} autoFocus>
              {t('common.tryAgain')}
            </Button>
            <Button variant="secondary" testId={TEST_IDS.loadingBack} onClick={onBack}>
              {t('common.mainMenu')}
            </Button>
          </div>
        ) : (
          <div className="pb-stack loading-stack">
            <ProgressBar
              value={state.phase === 'ready' ? 1 : state.progress.ratio}
              label={t('loading.progress')}
              testId={TEST_IDS.loadingProgress}
            />
            <p className="pb-muted loading-caption" aria-live="polite">
              {state.phase === 'ready'
                ? t('loading.ready')
                : t('loading.current', { current: state.progress.current })}
            </p>
          </div>
        )}
      </Panel>
    </ScreenTemplate>
  );
}

function describeLoadError(t: Translate, assetUrl: string | null): string {
  if (assetUrl === null) return t('loading.failed');
  return t('loading.assetFailed', { asset: assetUrl.split('/').pop() ?? t('loading.unknownAsset') });
}
