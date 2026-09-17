import { formatClock } from '@/app/format';
import { useTranslation } from '@/app/useTranslation';
import type { HudSnapshot } from '@/game/battleRuntime';
import { TEST_IDS } from '@/testing/testIds';
import { IconButton, VisuallyHidden } from '@/ui';
import './Hud.css';

export interface HudProps {
  snapshot: HudSnapshot;
  announcement: string;
  onPause: () => void;
}

export function Hud({ snapshot, announcement, onPause }: HudProps): React.JSX.Element {
  const { t } = useTranslation();
  const statusLabel = t(
    snapshot.status === 'paused'
      ? 'hud.paused'
      : snapshot.status === 'ended'
        ? 'hud.battleOver'
        : 'hud.inBattle',
  );
  return (
    <section className="hud" aria-label={t('hud.label')}>
      <div className="hud-actions">
        <IconButton
          icon="pause"
          label={t('hud.pause')}
          testId={TEST_IDS.hudPause}
          onClick={onPause}
          disabled={snapshot.status !== 'running'}
        />
      </div>
      <VisuallyHidden>
        <p>
          {t('hud.score')} <span data-testid={TEST_IDS.hudScore}>{snapshot.score}</span>
        </p>
        <p>
          {t('hud.timeRemaining')}{' '}
          <span data-testid={TEST_IDS.hudTime}>{formatClock(snapshot.secondsLeft)}</span>
        </p>
        <div
          role="meter"
          aria-label={t('hud.health')}
          aria-valuemin={0}
          aria-valuemax={snapshot.maxHealth}
          aria-valuenow={snapshot.health}
          aria-valuetext={t('hud.healthValue', { health: snapshot.health, max: snapshot.maxHealth })}
          data-testid={TEST_IDS.hudHealth}
        >
          {snapshot.health} / {snapshot.maxHealth}
        </div>
        <p data-testid={TEST_IDS.hudStatus}>
          {t('hud.status', {
            status: statusLabel,
            score: snapshot.score,
            time: formatClock(snapshot.secondsLeft),
            health: snapshot.health,
            max: snapshot.maxHealth,
          })}
        </p>
        <p role="status" aria-live="polite">
          {announcement}
        </p>
      </VisuallyHidden>
    </section>
  );
}
