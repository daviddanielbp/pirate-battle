import { useEffect, useState } from 'react';
import { formatClock, formatPlayedAt, endReasonLabelKey } from '@/app/format';
import { useTranslation } from '@/app/useTranslation';
import type { LogTab } from '@/app/screens';
import { useUiSounds } from '@/app/useUiSounds';
import type { MatchRecord, RankingEntry } from '@/data/contracts';
import { useHistoryQuery, useRankingQuery } from '@/data/hooks';
import { usePendingSubmissions } from '@/data/pendingSubmissions';
import { flushPending, submitPending } from '@/data/submissionManager';
import { usePlayerOptions } from '@/storage/optionsStore';
import type { PlayerIdentity } from '@/storage/playerIdentity';
import { TEST_IDS } from '@/testing/testIds';
import {
  Button,
  DataTable,
  Pagination,
  Panel,
  ScreenTemplate,
  StatusMessage,
  TabPanel,
  Tabs,
  VisuallyHidden,
  type DataTableRow,
} from '@/ui';
import './LogScreen.css';

export interface LogScreenProps {
  initialTab: LogTab;
  player: PlayerIdentity;
  onBack: () => void;
}

export function LogScreen({ initialTab, player, onBack }: LogScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LogTab>(initialTab);
  const sounds = useUiSounds();
  const options = usePlayerOptions();
  const tabItems = [
    { id: 'ranking', label: t('log.tabRanking'), testId: TEST_IDS.logTabRanking },
    { id: 'history', label: t('log.tabHistory'), testId: TEST_IDS.logTabHistory },
  ];

  useEffect(() => {
    void flushPending();
  }, []);

  return (
    <ScreenTemplate testId={TEST_IDS.screenLog}>
      <Panel size="wide" title={t('log.title')} headingLevel={1} className="log-panel">
        <Tabs
          tabs={tabItems}
          activeId={tab}
          ariaLabel={t('log.sections')}
          idPrefix="captains-log"
          onChange={(id) => {
            sounds.click();
            setTab(id === 'history' ? 'history' : 'ranking');
          }}
          className="log-tabs"
        />
        <TabPanel
          idPrefix="captains-log"
          tabId="ranking"
          active={tab === 'ranking'}
          testId={TEST_IDS.logPanelRanking}
        >
          {tab === 'ranking' && (
            <RankingPanel key={`${options.sessionSeconds}:${options.spawnIntervalSeconds}`} player={player} />
          )}
        </TabPanel>
        <TabPanel
          idPrefix="captains-log"
          tabId="history"
          active={tab === 'history'}
          testId={TEST_IDS.logPanelHistory}
        >
          {tab === 'history' && <HistoryPanel player={player} />}
        </TabPanel>
        <div className="log-footer">
          <Button
            testId={TEST_IDS.logMainMenu}
            onClick={() => {
              sounds.back();
              onBack();
            }}
          >
            {t('common.mainMenu')}
          </Button>
        </div>
      </Panel>
    </ScreenTemplate>
  );
}

interface QueryStateProps {
  isPending: boolean;
  isError: boolean;
  errorMessage: string | null;
  isEmpty: boolean;
  isRefreshing: boolean;
  emptyText: string;
  onRetry: () => void;
}

function QueryState({
  isPending,
  isError,
  errorMessage,
  isEmpty,
  isRefreshing,
  emptyText,
  onRetry,
}: QueryStateProps) {
  const { t } = useTranslation();
  if (isPending) {
    return (
      <p className="log-state" role="status" data-testid={TEST_IDS.logLoading}>
        {t('log.loading')}
      </p>
    );
  }
  if (isError) {
    return (
      <div className="log-state-block">
        <StatusMessage tone="danger" testId={TEST_IDS.logError}>
          {errorMessage ?? t('log.unavailable')}
        </StatusMessage>
        <Button size="small" variant="secondary" testId={TEST_IDS.logRetry} onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }
  return (
    <>
      {isRefreshing && (
        <p className="log-refreshing" role="status" data-testid={TEST_IDS.logRefreshing}>
          {t('log.updating')}
        </p>
      )}
      {isEmpty && (
        <p className="log-state" data-testid={TEST_IDS.logEmpty}>
          {emptyText}
        </p>
      )}
    </>
  );
}

function RankingPanel({ player }: { player: PlayerIdentity }): React.JSX.Element {
  const { t } = useTranslation();
  const options = usePlayerOptions();
  const config = {
    sessionSeconds: options.sessionSeconds,
    spawnIntervalSeconds: options.spawnIntervalSeconds,
  };
  const [page, setPage] = useState(1);
  const query = useRankingQuery(config, page);
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);

  const rows: DataTableRow<'rank' | 'captain' | 'points' | 'played'>[] = items.map((entry: RankingEntry) => {
    const played = formatPlayedAt(entry.playedAt);
    const mine = entry.playerId === player.id;
    return {
      id: entry.matchId,
      highlighted: mine,
      testId: TEST_IDS.logRow,
      cells: {
        rank: <span className="pb-number">{String(entry.rank).padStart(2, '0')}</span>,
        captain: (
          <span className="log-captain">
            {entry.rank === 1 && <span aria-hidden="true">★ </span>}
            {entry.playerName}
            {mine && <span className="log-you">{t('log.you')}</span>}
          </span>
        ),
        points: <span className="pb-number">{entry.score}</span>,
        played: (
          <span className="log-date">
            {played.day} <span className="pb-muted">· {played.time}</span>
          </span>
        ),
      },
    };
  });

  return (
    <div className="log-section">
      <p className="pb-eyebrow log-subtitle">
        {t('log.rankingSubtitle', { session: config.sessionSeconds, spawn: config.spawnIntervalSeconds })}
      </p>
      <QueryState
        isPending={query.isPending}
        isError={query.isError && !query.data}
        errorMessage={query.error?.message ?? null}
        isEmpty={!query.isPending && !query.isError && items.length === 0}
        isRefreshing={query.isFetching && !query.isPending}
        emptyText={t('log.rankingEmpty')}
        onRetry={query.refetch}
      />
      {rows.length > 0 && (
        <DataTable
          caption={t('log.rankingCaption')}
          columns={[
            { key: 'rank', header: t('log.rank'), width: '14%' },
            { key: 'captain', header: t('log.captain') },
            { key: 'points', header: t('log.points'), width: '16%' },
            { key: 'played', header: t('log.played'), width: '26%' },
          ]}
          rows={rows}
          className={query.isPlaceholderData ? 'log-table log-table-stale' : 'log-table'}
        />
      )}
      {query.isError && query.data && (
        <StatusMessage tone="warning" testId={TEST_IDS.logError}>
          {t('log.rankingStale')} {query.error?.message ?? t('log.updateFailed')}
        </StatusMessage>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        disabled={query.isPending}
        ariaLabel={t('log.rankingPages')}
        previousLabel={t('log.previousPage')}
        nextLabel={t('log.nextPage')}
        formatPageLabel={(current, total) => t('log.pageOf', { page: current, total })}
        testIds={{ prev: TEST_IDS.logPrevPage, next: TEST_IDS.logNextPage, label: TEST_IDS.logPageLabel }}
      />
    </div>
  );
}

function HistoryPanel({ player }: { player: PlayerIdentity }): React.JSX.Element {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useHistoryQuery(player.id, page);
  const pending = usePendingSubmissions();
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);

  const rows: DataTableRow<'date' | 'points' | 'duration' | 'result'>[] = items.map((record: MatchRecord) => {
    const played = formatPlayedAt(record.playedAt);
    return {
      id: record.id,
      testId: TEST_IDS.logRow,
      cells: {
        date: (
          <span className="log-date">
            {played.day} <span className="pb-muted">· {played.time}</span>
          </span>
        ),
        points: <span className="pb-number">{record.score}</span>,
        duration: <span className="pb-number">{formatClock(record.durationSeconds)}</span>,
        result: (
          <span className="log-result-cell">
            <span
              className={
                record.endReason === 'time_up'
                  ? 'log-result log-result-time'
                  : 'log-result log-result-defeated'
              }
            >
              {t(endReasonLabelKey(record.endReason))}
            </span>
            {record.loadout && (
              <span className="pb-muted log-loadout">
                {t('log.loadout', {
                  level: record.loadout.level,
                  cannon: t(record.loadout.cannon === 'double' ? 'log.cannonTwin' : 'log.cannonIron'),
                })}
              </span>
            )}
          </span>
        ),
      },
    };
  });

  return (
    <div className="log-section">
      <p className="pb-eyebrow log-subtitle">{t('log.historySubtitle', { name: player.name })}</p>
      {pending.length > 0 && (
        <ul className="log-pending" aria-label={t('log.pendingList')}>
          {pending.map((entry) => (
            <li key={entry.record.id} className="log-pending-row" data-testid={TEST_IDS.logPendingRow}>
              <span>
                {t('log.pendingRow', {
                  day: formatPlayedAt(entry.record.playedAt).day,
                  score: entry.record.score,
                  status: t(
                    entry.status === 'submitting'
                      ? 'log.pendingSending'
                      : entry.status === 'failed'
                        ? 'log.pendingFailed'
                        : 'log.pendingWaiting',
                  ),
                })}
              </span>
              {entry.status !== 'submitting' && (
                <Button
                  size="small"
                  variant="secondary"
                  testId={TEST_IDS.logPendingRetry}
                  onClick={() => void submitPending(entry.record.id)}
                >
                  {t('log.sendAgain')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <QueryState
        isPending={query.isPending}
        isError={query.isError && !query.data}
        errorMessage={query.error?.message ?? null}
        isEmpty={!query.isPending && !query.isError && items.length === 0}
        isRefreshing={query.isFetching && !query.isPending}
        emptyText={t('log.historyEmpty')}
        onRetry={query.refetch}
      />
      {rows.length > 0 && (
        <DataTable
          caption={t('log.historyCaption')}
          columns={[
            { key: 'date', header: t('log.date'), width: '30%' },
            { key: 'points', header: t('log.points'), width: '18%' },
            { key: 'duration', header: t('log.duration'), width: '22%' },
            { key: 'result', header: t('log.result') },
          ]}
          rows={rows}
          className={query.isPlaceholderData ? 'log-table log-table-stale' : 'log-table'}
        />
      )}
      {query.isError && query.data && (
        <StatusMessage tone="warning" testId={TEST_IDS.logError}>
          {t('log.historyStale')} {query.error?.message ?? t('log.updateFailed')}
        </StatusMessage>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        disabled={query.isPending}
        ariaLabel={t('log.historyPages')}
        previousLabel={t('log.previousPage')}
        nextLabel={t('log.nextPage')}
        formatPageLabel={(current, total) => t('log.pageOf', { page: current, total })}
        testIds={{ prev: TEST_IDS.logPrevPage, next: TEST_IDS.logNextPage, label: TEST_IDS.logPageLabel }}
      />
      <VisuallyHidden>
        <span aria-live="polite">{query.isFetching ? t('log.updatingHistory') : ''}</span>
      </VisuallyHidden>
    </div>
  );
}
