import { useAppAudio } from '@/app/audioContext';
import { useTranslation } from '@/app/useTranslation';
import { TEST_IDS } from '@/testing/testIds';
import { Button, ScreenTemplate, TITLE_ART_URL } from '@/ui';
import './SplashScreen.css';

export interface SplashScreenProps {
  onStart: () => void;
}

export function SplashScreen({ onStart }: SplashScreenProps): React.JSX.Element {
  const { engine } = useAppAudio();
  const { t } = useTranslation();
  return (
    <ScreenTemplate testId={TEST_IDS.screenSplash} className="splash">
      <div className="splash-content">
        <h1 className="splash-title">
          <img src={TITLE_ART_URL} alt="Pirate Battle" className="splash-title-art" />
        </h1>
        <p className="pb-eyebrow splash-tagline">{t('splash.tagline')}</p>
        <Button
          className="splash-start"
          testId={TEST_IDS.splashStart}
          autoFocus
          onClick={() => {
            engine.unlock();
            engine.play('uiOpen', { volume: 0.5 });
            onStart();
          }}
        >
          {t('splash.start')}
        </Button>
        <p className="splash-hint">{t('splash.hint')}</p>
      </div>
    </ScreenTemplate>
  );
}
