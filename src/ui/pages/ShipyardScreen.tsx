import { useState } from 'react';
import {
  CANNON_CATALOG,
  HULL_CATALOG,
  MAX_UPGRADE_LEVEL,
  UPGRADE_CATALOG,
  UPGRADE_STEP,
  buyCannon,
  buyHull,
  buyUpgrade,
  levelFromXp,
  selectCannon,
  selectHull,
  type CannonItem,
  type HullItem,
  type PlayerProgress,
  type PurchaseError,
  type UpgradeItem,
} from '@/game/progression/progression';
import type { MessageKey, MessageParams, Translate } from '@/i18n';
import { savePlayerProgress, usePlayerProgress } from '@/storage/progressStore';
import { TEST_IDS } from '@/testing/testIds';
import { Button, HullSprite, Panel, ProgressBar, ScreenTemplate, StatusMessage } from '@/ui';
import { useTranslation } from '@/app/useTranslation';
import { useUiSounds } from '@/app/useUiSounds';
import './ShipyardScreen.css';

export interface ShipyardScreenProps {
  onBack: () => void;
}

type FeedbackTone = 'info' | 'success' | 'warning';

interface Feedback {
  tone: FeedbackTone;
  key: MessageKey;
  params?: MessageParams;
}

const IDLE_FEEDBACK: Feedback = { tone: 'info', key: 'shipyard.idle' };

function failureFeedback(reason: PurchaseError, name: string, price: number, coins: number): Feedback {
  switch (reason) {
    case 'coins':
      return { tone: 'warning', key: 'shipyard.notEnoughCoins', params: { name, price, coins } };
    case 'owned':
      return { tone: 'warning', key: 'shipyard.alreadyOwned', params: { name } };
    case 'maxed':
      return { tone: 'warning', key: 'shipyard.alreadyMaxed', params: { name } };
  }
}

function priceLabel(t: Translate, price: number): string {
  return price === 1 ? t('shipyard.priceOne') : t('shipyard.priceMany', { price });
}

function UpgradePips({ level }: { level: number }): React.JSX.Element {
  return (
    <span className="shipyard-pips" aria-hidden="true">
      {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => (
        <span key={index} className={index < level ? 'shipyard-pip shipyard-pip--filled' : 'shipyard-pip'} />
      ))}
    </span>
  );
}

export function ShipyardScreen({ onBack }: ShipyardScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  const sounds = useUiSounds();
  const progress = usePlayerProgress();
  const level = levelFromXp(progress.xp);
  const [feedback, setFeedback] = useState<Feedback>(IDLE_FEEDBACK);

  const commit = (next: PlayerProgress, key: MessageKey, params: MessageParams) => {
    savePlayerProgress(next);
    sounds.click();
    setFeedback({ tone: 'success', key, params });
  };

  const handleHull = (item: HullItem) => {
    if (progress.hull === item.id) return;
    if (progress.ownedHulls.includes(item.id)) {
      commit(selectHull(progress, item.id), 'shipyard.equippedMessage', { name: item.name });
      return;
    }
    const result = buyHull(progress, item.id);
    if (result.ok) {
      commit(result.progress, 'shipyard.purchasedMessage', { name: item.name });
    } else {
      setFeedback(failureFeedback(result.reason, item.name, item.price, progress.coins));
    }
  };

  const handleCannon = (item: CannonItem) => {
    if (progress.cannon === item.id) return;
    if (progress.ownedCannons.includes(item.id)) {
      commit(selectCannon(progress, item.id), 'shipyard.equippedMessage', { name: item.name });
      return;
    }
    const result = buyCannon(progress, item.id);
    if (result.ok) {
      commit(result.progress, 'shipyard.purchasedMessage', { name: item.name });
    } else {
      setFeedback(failureFeedback(result.reason, item.name, item.price, progress.coins));
    }
  };

  const handleUpgrade = (item: UpgradeItem) => {
    const current = progress.upgrades[item.id];
    const price = item.prices[current] ?? 0;
    const result = buyUpgrade(progress, item.id);
    if (result.ok) {
      commit(result.progress, 'shipyard.upgradedMessage', { name: item.name, level: current + 1 });
    } else {
      setFeedback(failureFeedback(result.reason, item.name, price, progress.coins));
    }
  };

  return (
    <ScreenTemplate testId={TEST_IDS.screenShipyard}>
      <Panel size="wide" title={t('shipyard.title')} headingLevel={1} className="shipyard-panel">
        <header className="shipyard-summary">
          <div className="shipyard-stat">
            <span className="pb-eyebrow pb-eyebrow--muted">{t('shipyard.treasury')}</span>
            <span className="shipyard-stat__value" data-testid={TEST_IDS.shipyardCoins}>
              <span className="pb-number shipyard-stat__number">{progress.coins}</span>{' '}
              {t('shipyard.coinsUnit')}
            </span>
          </div>
          <div className="shipyard-stat">
            <span className="pb-eyebrow pb-eyebrow--muted">{t('shipyard.rank')}</span>
            <span className="shipyard-stat__value" data-testid={TEST_IDS.shipyardLevel}>
              {t('shipyard.levelPrefix')}{' '}
              <span className="pb-number shipyard-stat__number">{level.level}</span>
            </span>
          </div>
          <div className="shipyard-xp">
            <ProgressBar
              value={level.xpIntoLevel / level.xpForNext}
              label={t('shipyard.experience')}
              showValue={false}
            />
            <span className="shipyard-xp__text pb-muted" data-testid={TEST_IDS.shipyardXp}>
              {t('shipyard.xp', { current: level.xpIntoLevel, next: level.xpForNext })}
            </span>
          </div>
        </header>
        <p className="shipyard-hint">{t('shipyard.hint')}</p>

        <section className="shipyard-section" aria-labelledby="shipyard-hulls-heading">
          <h2 id="shipyard-hulls-heading" className="shipyard-section__title">
            {t('shipyard.hulls')}
          </h2>
          <ul className="shipyard-grid">
            {HULL_CATALOG.map((item) => {
              const equipped = progress.hull === item.id;
              const owned = progress.ownedHulls.includes(item.id);
              const affordable = progress.coins >= item.price;
              return (
                <li
                  key={item.id}
                  className={equipped ? 'shipyard-card shipyard-card--equipped' : 'shipyard-card'}
                  data-affordable={owned || affordable ? 'true' : 'false'}
                >
                  <span className="shipyard-card__art">
                    <HullSprite scale={0.45} hull={item.id} />
                  </span>
                  <span className="shipyard-card__name">{item.name}</span>
                  <span className="shipyard-card__description pb-muted">{item.trait}</span>
                  <span className="shipyard-card__price">
                    {equipped
                      ? t('shipyard.equipped')
                      : owned
                        ? t('shipyard.owned')
                        : priceLabel(t, item.price)}
                  </span>
                  <Button
                    size="small"
                    variant={owned ? 'secondary' : 'primary'}
                    className="shipyard-action"
                    testId={TEST_IDS.shipyardHull}
                    data-item={item.id}
                    disabled={equipped}
                    aria-label={
                      equipped
                        ? t('shipyard.equippedLabel', { name: item.name })
                        : owned
                          ? t('shipyard.equipLabel', { name: item.name })
                          : t('shipyard.buyLabel', { name: item.name, price: priceLabel(t, item.price) })
                    }
                    onClick={() => {
                      handleHull(item);
                    }}
                  >
                    {equipped
                      ? t('shipyard.equipped')
                      : owned
                        ? t('shipyard.equip')
                        : t('shipyard.buy', { price: item.price })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="shipyard-section" aria-labelledby="shipyard-cannons-heading">
          <h2 id="shipyard-cannons-heading" className="shipyard-section__title">
            {t('shipyard.cannons')}
          </h2>
          <ul className="shipyard-grid shipyard-grid--cannons">
            {CANNON_CATALOG.map((item) => {
              const equipped = progress.cannon === item.id;
              const owned = progress.ownedCannons.includes(item.id);
              const affordable = progress.coins >= item.price;
              return (
                <li
                  key={item.id}
                  className={equipped ? 'shipyard-card shipyard-card--equipped' : 'shipyard-card'}
                  data-affordable={owned || affordable ? 'true' : 'false'}
                >
                  <span className="shipyard-card__name">{item.name}</span>
                  <span className="shipyard-card__description pb-muted">{item.description}</span>
                  <span className="shipyard-card__price">
                    {equipped
                      ? t('shipyard.equipped')
                      : owned
                        ? t('shipyard.owned')
                        : priceLabel(t, item.price)}
                  </span>
                  <Button
                    size="small"
                    variant={owned ? 'secondary' : 'primary'}
                    className="shipyard-action"
                    testId={TEST_IDS.shipyardCannon}
                    data-item={item.id}
                    disabled={equipped}
                    aria-label={
                      equipped
                        ? t('shipyard.equippedLabel', { name: item.name })
                        : owned
                          ? t('shipyard.equipLabel', { name: item.name })
                          : t('shipyard.buyLabel', { name: item.name, price: priceLabel(t, item.price) })
                    }
                    onClick={() => {
                      handleCannon(item);
                    }}
                  >
                    {equipped
                      ? t('shipyard.equipped')
                      : owned
                        ? t('shipyard.equip')
                        : t('shipyard.buy', { price: item.price })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="shipyard-section" aria-labelledby="shipyard-upgrades-heading">
          <h2 id="shipyard-upgrades-heading" className="shipyard-section__title">
            {t('shipyard.upgrades')}
          </h2>
          <ul className="shipyard-upgrades">
            {UPGRADE_CATALOG.map((item) => {
              const current = progress.upgrades[item.id];
              const maxed = current >= MAX_UPGRADE_LEVEL;
              const nextPrice = item.prices[current];
              const bonus = Math.round(current * UPGRADE_STEP * 100);
              const affordable = nextPrice !== undefined && progress.coins >= nextPrice;
              return (
                <li
                  key={item.id}
                  className="shipyard-upgrade"
                  data-affordable={maxed || affordable ? 'true' : 'false'}
                >
                  <div className="shipyard-upgrade__info">
                    <span className="shipyard-card__name">{item.name}</span>
                    <span className="shipyard-card__description pb-muted">{item.description}</span>
                  </div>
                  <div className="shipyard-upgrade__level">
                    <UpgradePips level={current} />
                    <span className="shipyard-upgrade__level-text">
                      {t('shipyard.upgradeLevel', { level: current, max: MAX_UPGRADE_LEVEL, bonus })}
                    </span>
                  </div>
                  <span className="shipyard-card__price">
                    {nextPrice === undefined ? t('shipyard.max') : priceLabel(t, nextPrice)}
                  </span>
                  <Button
                    size="small"
                    className="shipyard-action"
                    testId={TEST_IDS.shipyardUpgrade}
                    data-item={item.id}
                    disabled={maxed}
                    aria-label={
                      nextPrice === undefined
                        ? t('shipyard.maxedLabel', { name: item.name })
                        : t('shipyard.upgradeLabel', {
                            name: item.name,
                            level: current + 1,
                            price: priceLabel(t, nextPrice),
                          })
                    }
                    onClick={() => {
                      handleUpgrade(item);
                    }}
                  >
                    {nextPrice === undefined
                      ? t('shipyard.maxed')
                      : t('shipyard.upgrade', { price: nextPrice })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <StatusMessage tone={feedback.tone} testId={TEST_IDS.shipyardMessage} className="shipyard-message">
          {t(feedback.key, feedback.params)}
        </StatusMessage>

        <footer className="shipyard-footer">
          <Button
            variant="secondary"
            testId={TEST_IDS.shipyardBack}
            onClick={() => {
              sounds.back();
              onBack();
            }}
          >
            {t('common.mainMenu')}
          </Button>
        </footer>
      </Panel>
    </ScreenTemplate>
  );
}
