import { useState } from 'react';
import { usePendingSubmissions } from '@/data/pendingSubmissions';
import { HULL_CATALOG, levelFromXp } from '@/game/progression/progression';
import { usePlayerProgress } from '@/storage/progressStore';
import { CONTROL_GUIDE } from '@/game/input/controls';
import type { MessageKey } from '@/i18n';
import { TEST_IDS } from '@/testing/testIds';
import { Button, HullSprite, Kbd, Panel, ProgressBar, ScreenTemplate, StatusMessage, TITLE_ART_URL } from '@/ui';
import type { LogTab } from '@/app/screens';
import { useTranslation } from '@/app/useTranslation';
import { useUiSounds } from '@/app/useUiSounds';
import { NetworkLabDialog } from '@/ui/organisms/NetworkLabDialog';
import './MenuScreen.css';

export interface MenuScreenProps {
  onPlay: () => void;
  onOptions: () => void;
  onShipyard: () => void;
  onOpenLog: (tab: LogTab) => void;
}

interface ControlMessages {
  action: MessageKey;
  keys: MessageKey;
  touch: MessageKey;
}

const CONTROL_MESSAGES: Readonly<Record<string, ControlMessages>> = {
  'Sail forward': {
    action: 'controls.sailForward',
    keys: 'controls.sailForwardKeys',
    touch: 'controls.sailForwardTouch',
  },
  'Turn left / right': { action: 'controls.turn', keys: 'controls.turnKeys', touch: 'controls.turnTouch' },
  'Fire front cannon': {
    action: 'controls.fireFront',
    keys: 'controls.fireFrontKeys',
    touch: 'controls.fireFrontTouch',
  },
  'Port broadside (left)': {
    action: 'controls.portBroadside',
    keys: 'controls.portBroadsideKeys',
    touch: 'controls.portBroadsideTouch',
  },
  'Starboard broadside (right)': {
    action: 'controls.starboardBroadside',
    keys: 'controls.starboardBroadsideKeys',
    touch: 'controls.starboardBroadsideTouch',
  },
  Pause: { action: 'controls.pause', keys: 'controls.pauseKeys', touch: 'controls.pauseTouch' },
};

export function MenuScreen({ onPlay, onOptions, onShipyard, onOpenLog }: MenuScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const sounds = useUiSounds();
  const pending = usePendingSubmissions();
  const progress = usePlayerProgress();
  const level = levelFromXp(progress.xp);
  const [labOpen, setLabOpen] = useState(false);

  return (
    <ScreenTemplate testId={TEST_IDS.screenMenu}>
      <Panel size="wide" as="section" aria-label={t('menu.label')} className="menu-panel">
        <div className="menu-layout">
          <aside className="menu-side menu-side--guide">
            <section
              className="menu-controls"
              aria-labelledby="menu-controls-heading"
              data-testid={TEST_IDS.menuControls}
            >
              <h2 id="menu-controls-heading" className="pb-eyebrow">
                {t('menu.controls')}
              </h2>
              <dl className="menu-controls-list">
                {CONTROL_GUIDE.map((entry) => {
                  const messages = CONTROL_MESSAGES[entry.action];
                  return (
                    <div key={entry.action} className="menu-controls-item">
                      <dt>{messages ? t(messages.action) : entry.action}</dt>
                      <dd>
                        <Kbd>{messages ? t(messages.keys) : entry.keys}</Kbd>
                        <span className="pb-muted menu-controls-touch">
                          {messages ? t(messages.touch) : entry.touch}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          </aside>
          <div className="menu-center">
            <h1 className="menu-title">
              <img src={TITLE_ART_URL} alt="Pirate Battle" className="menu-title-art" />
            </h1>
            <p className="pb-eyebrow menu-tagline">{t('menu.tagline')}</p>
            <div className="pb-stack menu-actions">
              <Button
                testId={TEST_IDS.menuPlay}
                autoFocus
                onClick={() => {
                  sounds.click();
                  onPlay();
                }}
              >
                {t('menu.play')}
              </Button>
              <Button
                testId={TEST_IDS.menuOptions}
                onClick={() => {
                  sounds.click();
                  onOptions();
                }}
              >
                {t('menu.options')}
              </Button>
            </div>
            <p className="menu-caption">{t('menu.caption')}</p>
            <div className="pb-row menu-log-links">
              <Button
                variant="secondary"
                size="small"
                testId={TEST_IDS.menuRanking}
                onClick={() => {
                  sounds.open();
                  onOpenLog('ranking');
                }}
              >
                {t('menu.ranking')}
              </Button>
              <Button
                variant="secondary"
                size="small"
                testId={TEST_IDS.menuHistory}
                onClick={() => {
                  sounds.open();
                  onOpenLog('history');
                }}
              >
                {t('menu.history')}
              </Button>
            </div>
            {pending.length > 0 && (
              <StatusMessage tone="warning">
                {pending.length === 1 ? t('menu.pendingOne') : t('menu.pendingMany', { count: pending.length })}
              </StatusMessage>
            )}
          </div>
          <aside className="menu-side menu-side--ship">
            <h2 className="pb-eyebrow">{t('menu.yourShip')}</h2>
            <HullSprite hull={progress.hull} scale={0.9} className="menu-ship-sprite" />
            <p className="menu-ship-name">{HULL_CATALOG.find((hull) => hull.id === progress.hull)?.name ?? ''}</p>
            <p className="pb-eyebrow menu-progress">
              {t('menu.progress', {
                level: level.level,
                coins: progress.coins,
                xpIntoLevel: level.xpIntoLevel,
                xpForNext: level.xpForNext,
              })}
            </p>
            <ProgressBar value={level.xpForNext === 0 ? 0 : level.xpIntoLevel / level.xpForNext} label={t('shipyard.experience')} showValue={false} />
            <Button
              size="small"
              testId={TEST_IDS.menuShipyard}
              onClick={() => {
                sounds.click();
                onShipyard();
              }}
            >
              {t('menu.shipyard')}
            </Button>
          </aside>
        </div>
        <footer className="menu-footer">
          <button
            type="button"
            className="menu-network-link"
            data-testid={TEST_IDS.menuNetworkLab}
            onClick={() => {
              sounds.open();
              setLabOpen(true);
            }}
          >
            {t('menu.networkLab')}
          </button>
        </footer>
      </Panel>
      <NetworkLabDialog
        open={labOpen}
        onClose={() => {
          sounds.close();
          setLabOpen(false);
        }}
      />
    </ScreenTemplate>
  );
}
