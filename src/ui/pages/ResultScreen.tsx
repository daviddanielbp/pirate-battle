import { useEffect } from 'react';
import { endReasonLabelKey, endReasonTitleKey, formatClock } from '@/app/format';
import { useTranslation } from '@/app/useTranslation';
import { useUiSounds } from '@/app/useUiSounds';
import { submitPending, useSubmissionStatus } from '@/data/submissionManager';
import { useLastResult } from '@/storage/lastResultStore';
import { useLastRewards } from '@/storage/lastRewardsStore';
import { TEST_IDS } from '@/testing/testIds';
import type { MessageKey, MessageParams } from '@/i18n';
import { Button, Panel, ScreenTemplate, StatusMessage, type StatusTone } from '@/ui';
import './ResultScreen.css';

export interface ResultScreenProps {
  onPlayAgain: () => void;
  onMainMenu: () => void;
  onShipyard: () => void;
}

export function ResultScreen({ onPlayAgain, onMainMenu, onShipyard }: ResultScreenProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const result = useLastResult();
  const rewards = useLastRewards();
  const sounds = useUiSounds();
  const submission = useSubmissionStatus(result?.id ?? '');

  useEffect(() => {
    if (!result) onMainMenu();
  }, [result, onMainMenu]);

  if (!result) return null;

  const submissionView = describeSubmission(submission.status, submission.errorMessage);
  const matchRewards = rewards?.matchId === result.id ? rewards : null;

  return (
    <ScreenTemplate testId={TEST_IDS.screenResult}>
      <Panel
        size="regular"
        title={t(endReasonTitleKey(result.endReason))}
        headingLevel={1}
        className={result.endReason === 'time_up' ? 'result-panel result-panel--victory' : 'result-panel'}
      >
        {result.endReason === 'time_up' && <p className="result-victory-banner">{t('result.victory')}</p>}
        <p className="result-score" data-testid={TEST_IDS.resultScore}>
          {result.score}
        </p>
        <p className="pb-eyebrow result-summary">
          <span>{t('result.points')}</span>
          <span aria-hidden="true">·</span>
          <span data-testid={TEST_IDS.resultTime}>{formatClock(result.durationSeconds)}</span>
          <span aria-hidden="true">·</span>
          <span data-testid={TEST_IDS.resultReason}>{t(endReasonLabelKey(result.endReason))}</span>
        </p>
        {matchRewards && (
          <p className="result-rewards" data-testid={TEST_IDS.resultRewards}>
            {t('result.rewards', { coins: matchRewards.coins, xp: matchRewards.xp })}
            {matchRewards.levelAfter > matchRewards.levelBefore
              ? ` · ${t('result.levelUp', { level: matchRewards.levelAfter })}`
              : ''}
          </p>
        )}
        <div className="result-submission">
          <StatusMessage tone={submissionView.tone} testId={TEST_IDS.resultSubmission}>
            {t(submissionView.key, submissionView.params)}
          </StatusMessage>
          {submission.status === 'failed' && (
            <Button
              variant="secondary"
              size="small"
              testId={TEST_IDS.resultRetry}
              onClick={() => {
                sounds.click();
                void submitPending(result.id);
              }}
            >
              {t('common.tryAgain')}
            </Button>
          )}
        </div>
        <div className="pb-stack result-actions">
          <Button
            testId={TEST_IDS.resultPlayAgain}
            autoFocus
            onClick={() => {
              sounds.click();
              onPlayAgain();
            }}
          >
            {t('result.playAgain')}
          </Button>
          <div className="result-actions-row">
            <Button
              size="small"
              variant="secondary"
              testId={TEST_IDS.resultShipyard}
              onClick={() => {
                sounds.open();
                onShipyard();
              }}
            >
              {t('result.shipyard')}
            </Button>
            <Button
              size="small"
              variant="secondary"
              testId={TEST_IDS.resultMainMenu}
              onClick={() => {
                sounds.back();
                onMainMenu();
              }}
            >
              {t('common.mainMenu')}
            </Button>
          </div>
        </div>
      </Panel>
    </ScreenTemplate>
  );
}

interface SubmissionView {
  tone: StatusTone;
  key: MessageKey;
  params?: MessageParams;
}

function describeSubmission(status: string, errorMessage: string | null): SubmissionView {
  switch (status) {
    case 'confirmed':
      return { tone: 'success', key: 'result.recorded' };
    case 'submitting':
    case 'pending':
      return { tone: 'info', key: 'result.recording' };
    case 'failed':
      return {
        tone: 'warning',
        key: 'result.notRecorded',
        params: { detail: errorMessage ? ` (${errorMessage})` : '' },
      };
    default:
      return { tone: 'info', key: 'result.alreadyRecorded' };
  }
}
