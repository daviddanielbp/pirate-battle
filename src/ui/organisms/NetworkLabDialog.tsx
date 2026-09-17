import { useId, useState } from 'react';
import { useTranslation } from '@/app/useTranslation';
import type { MessageKey, MessageParams } from '@/i18n';
import { applyScenario, getActiveScenarioId, listScenarios, resetEverything } from '@/mocks/networkLab';
import { isScenarioId, type ScenarioId } from '@/mocks/scenarios';
import { TEST_IDS } from '@/testing/testIds';
import { Button, Dialog, StatusMessage } from '@/ui';
import './NetworkLabDialog.css';

export interface NetworkLabDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NetworkLabDialog({ open, onClose }: NetworkLabDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      title={t('networkLab.title')}
      onClose={onClose}
      size="regular"
      testId={TEST_IDS.networkLabDialog}
    >
      {open && <NetworkLabContent onClose={onClose} />}
    </Dialog>
  );
}

interface LabMessage {
  key: MessageKey;
  params?: MessageParams;
}

function NetworkLabContent({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ScenarioId>(() => getActiveScenarioId());
  const [active, setActive] = useState<ScenarioId>(() => getActiveScenarioId());
  const [message, setMessage] = useState<LabMessage | null>(null);
  const selectId = useId();
  const scenarios = listScenarios();
  const description = scenarios.find((scenario) => scenario.id === selected)?.description ?? '';

  return (
    <div className="network-lab">
      <p className="pb-muted network-lab-intro">{t('networkLab.intro')}</p>
      <label htmlFor={selectId} className="pb-eyebrow">
        {t('networkLab.scenario')}
      </label>
      <select
        id={selectId}
        className="network-lab-select"
        value={selected}
        data-testid={TEST_IDS.networkLabScenario}
        onChange={(event) => {
          const value = event.target.value;
          if (isScenarioId(value)) setSelected(value);
          setMessage(null);
        }}
      >
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.label}
          </option>
        ))}
      </select>
      <p className="network-lab-description">{description}</p>
      <p className="pb-muted network-lab-active">
        {t('networkLab.active')} <strong>{active}</strong>
      </p>
      {message && <StatusMessage tone="success">{t(message.key, message.params)}</StatusMessage>}
      <div className="pb-row network-lab-actions">
        <Button
          size="small"
          testId={TEST_IDS.networkLabApply}
          onClick={() => {
            applyScenario(selected);
            setActive(selected);
            setMessage({ key: 'networkLab.applied', params: { id: selected } });
          }}
        >
          {t('networkLab.apply')}
        </Button>
        <Button
          size="small"
          variant="secondary"
          testId={TEST_IDS.networkLabReset}
          onClick={() => {
            resetEverything();
            const current = getActiveScenarioId();
            setSelected(current);
            setActive(current);
            setMessage({ key: 'networkLab.resetDone' });
          }}
        >
          {t('networkLab.reset')}
        </Button>
        <Button size="small" variant="secondary" testId={TEST_IDS.networkLabClose} onClick={onClose}>
          {t('networkLab.close')}
        </Button>
      </div>
    </div>
  );
}
