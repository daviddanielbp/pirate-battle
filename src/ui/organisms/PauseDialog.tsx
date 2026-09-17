import { useRef, useState } from 'react';
import { useTranslation } from '@/app/useTranslation';
import { useUiSounds } from '@/app/useUiSounds';
import type { PauseReason } from '@/game/battleRuntime';
import { TEST_IDS } from '@/testing/testIds';
import { Button, Dialog } from '@/ui';
import { OptionsForm } from '@/ui/organisms/OptionsForm';
import './PauseDialog.css';

export interface PauseDialogProps {
  open: boolean;
  reason: PauseReason | null;
  onResume: () => void;
  onAbandon: () => void;
}

type View = 'menu' | 'options' | 'confirm';

export function PauseDialog({ open, reason, onResume, onAbandon }: PauseDialogProps): React.JSX.Element {
  const [view, setView] = useState<View>('menu');
  const resumeRef = useRef<HTMLButtonElement | null>(null);
  const sounds = useUiSounds();
  const { t } = useTranslation();

  if (!open && view !== 'menu') setView('menu');

  if (view === 'options') {
    return (
      <Dialog open={open} title={t('options.title')} size="regular" testId={TEST_IDS.pauseDialog}>
        <OptionsForm
          backLabel={t('pause.backToPause')}
          onBack={() => {
            setView('menu');
          }}
        />
      </Dialog>
    );
  }

  if (view === 'confirm') {
    return (
      <Dialog open={open} title={t('pause.abandonTitle')} size="compact" testId={TEST_IDS.confirmDialog}>
        <p className="pause-copy">{t('pause.abandonCopy')}</p>
        <div className="pb-stack pause-actions">
          <Button
            testId={TEST_IDS.confirmAccept}
            autoFocus
            onClick={() => {
              sounds.back();
              onAbandon();
            }}
          >
            {t('pause.leave')}
          </Button>
          <Button variant="secondary" testId={TEST_IDS.confirmCancel} onClick={() => setView('menu')}>
            {t('pause.keepFighting')}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title={t('pause.title')}
      size="regular"
      testId={TEST_IDS.pauseDialog}
      initialFocusRef={resumeRef}
    >
      <p className="pause-copy">{t(reason === 'focus' ? 'pause.focusLost' : 'pause.ready')}</p>
      <div className="pb-stack pause-actions">
        <Button
          ref={resumeRef}
          testId={TEST_IDS.pauseResume}
          onClick={() => {
            sounds.click();
            onResume();
          }}
        >
          {t('pause.resume')}
        </Button>
        <Button
          testId={TEST_IDS.pauseOptions}
          onClick={() => {
            sounds.open();
            setView('options');
          }}
        >
          {t('menu.options')}
        </Button>
        <Button
          testId={TEST_IDS.pauseMainMenu}
          onClick={() => {
            sounds.open();
            setView('confirm');
          }}
        >
          {t('common.mainMenu')}
        </Button>
      </div>
    </Dialog>
  );
}
