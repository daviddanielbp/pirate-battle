import { useTranslation } from '@/app/useTranslation';
import { TEST_IDS } from '@/testing/testIds';
import { Panel, ScreenTemplate } from '@/ui';
import { OptionsForm } from '@/ui/organisms/OptionsForm';

export interface OptionsScreenProps {
  onBack: () => void;
}

export function OptionsScreen({ onBack }: OptionsScreenProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <ScreenTemplate testId={TEST_IDS.screenOptions}>
      <Panel size="regular" title={t('options.title')} headingLevel={1}>
        <OptionsForm backLabel={t('common.mainMenu')} onBack={onBack} />
      </Panel>
    </ScreenTemplate>
  );
}
