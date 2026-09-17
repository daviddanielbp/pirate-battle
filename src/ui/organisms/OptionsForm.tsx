import { useId, useState } from 'react';
import { useAppAudio } from '@/app/audioContext';
import { useTranslation } from '@/app/useTranslation';
import { useUiSounds } from '@/app/useUiSounds';
import { OPTION_LIMITS, type PlayerOptions, type SteeringMode } from '@/game/config/gameplayConfig';
import {
  DEFAULT_LANGUAGE,
  isLanguageCode,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type MessageKey,
} from '@/i18n';
import { savePlayerOptions, usePlayerOptions, validatePlayerOptions } from '@/storage/optionsStore';
import { TEST_IDS } from '@/testing/testIds';
import { Button, Slider, StatusMessage, Stepper, Toggle } from '@/ui';
import './OptionsForm.css';

export interface OptionsFormProps {
  backLabel: string;
  onBack: () => void;
}

export function OptionsForm({ backLabel, onBack }: OptionsFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const stored = usePlayerOptions();
  const audio = useAppAudio();
  const sounds = useUiSounds();
  const [draft, setDraft] = useState<PlayerOptions>(stored);
  const [volume, setVolume] = useState(Math.round(audio.settings.volume * 100));
  const [muted, setMuted] = useState(audio.settings.muted);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<MessageKey | null>(null);
  const hintId = useId();
  const steeringId = useId();
  const languageId = useId();

  const validation = validatePlayerOptions(draft);
  const invalid = validation.sessionSeconds !== null || validation.spawnIntervalSeconds !== null;
  const dirty =
    draft.sessionSeconds !== stored.sessionSeconds ||
    draft.spawnIntervalSeconds !== stored.spawnIntervalSeconds ||
    draft.steering !== stored.steering ||
    draft.language !== stored.language ||
    volume !== Math.round(audio.settings.volume * 100) ||
    muted !== audio.settings.muted;

  const update = (patch: Partial<PlayerOptions>): void => {
    setSaved(false);
    setSaveError(null);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (invalid) {
      setSaveError('options.fixValues');
      return;
    }
    const persisted = savePlayerOptions(draft);
    if (!persisted) {
      setSaveError('options.saveFailed');
      return;
    }
    audio.updateSettings({ volume: volume / 100, muted });
    sounds.click();
    setSaved(true);
    setSaveError(null);
  };

  const sessionLimits = OPTION_LIMITS.sessionSeconds;
  const spawnLimits = OPTION_LIMITS.spawnIntervalSeconds;

  return (
    <form className="options-form" onSubmit={handleSubmit} noValidate aria-describedby={hintId}>
      <p id={hintId} className="options-hint">
        {t('options.hint', {
          sessionMin: sessionLimits.min,
          sessionMax: sessionLimits.max,
          spawnMin: spawnLimits.min,
          spawnMax: spawnLimits.max,
        })}
      </p>
      <Stepper
        label={t('options.sessionTime')}
        value={draft.sessionSeconds}
        min={sessionLimits.min}
        max={sessionLimits.max}
        step={sessionLimits.step}
        unit="s"
        onChange={(value) => update({ sessionSeconds: value })}
        decreaseLabel={t('options.sessionDecrease')}
        increaseLabel={t('options.sessionIncrease')}
        error={
          validation.sessionSeconds === null
            ? undefined
            : t('options.sessionRange', { min: sessionLimits.min, max: sessionLimits.max })
        }
        testIds={{
          value: TEST_IDS.optionsSession,
          decrease: TEST_IDS.optionsSessionDecrease,
          increase: TEST_IDS.optionsSessionIncrease,
        }}
      />
      <Stepper
        label={t('options.spawnTime')}
        value={draft.spawnIntervalSeconds}
        min={spawnLimits.min}
        max={spawnLimits.max}
        step={spawnLimits.step}
        unit="s"
        onChange={(value) => update({ spawnIntervalSeconds: value })}
        decreaseLabel={t('options.spawnDecrease')}
        increaseLabel={t('options.spawnIncrease')}
        error={
          validation.spawnIntervalSeconds === null
            ? undefined
            : t('options.spawnRange', { min: spawnLimits.min, max: spawnLimits.max })
        }
        testIds={{
          value: TEST_IDS.optionsSpawn,
          decrease: TEST_IDS.optionsSpawnDecrease,
          increase: TEST_IDS.optionsSpawnIncrease,
        }}
      />
      <div className="options-field">
        <label htmlFor={steeringId} className="options-label">
          {t('options.steering')}
        </label>
        <select
          id={steeringId}
          className="options-select"
          value={draft.steering}
          data-testid={TEST_IDS.optionsSteering}
          onChange={(event) => {
            const value = event.target.value;
            const steering: SteeringMode = value === 'mouse' ? 'mouse' : 'keyboard';
            update({ steering });
          }}
        >
          <option value="keyboard">{t('options.steeringKeyboard')}</option>
          <option value="mouse">{t('options.steeringMouse')}</option>
        </select>
        <p className="options-hint">{t('options.steeringHint')}</p>
      </div>
      <div className="options-field">
        <label htmlFor={languageId} className="options-label">
          {t('options.language')}
        </label>
        <select
          id={languageId}
          className="options-select"
          value={draft.language}
          data-testid={TEST_IDS.optionsLanguage}
          onChange={(event) => {
            const value = event.target.value;
            update({ language: isLanguageCode(value) ? value : DEFAULT_LANGUAGE });
          }}
        >
          {SUPPORTED_LANGUAGES.map((code) => (
            <option key={code} value={code} lang={code}>
              {LANGUAGE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
      <Slider
        label={t('options.volume')}
        value={volume}
        min={0}
        max={100}
        step={5}
        valueText={t('options.volumeValue', { volume })}
        onChange={(value) => {
          setSaved(false);
          setVolume(value);
        }}
        testId={TEST_IDS.optionsVolume}
      />
      <Toggle
        label={t('options.mute')}
        checked={muted}
        onChange={(value) => {
          setSaved(false);
          setMuted(value);
        }}
        testId={TEST_IDS.optionsMute}
      />
      {saveError && (
        <StatusMessage tone="danger" testId={TEST_IDS.optionsError}>
          {t(saveError)}
        </StatusMessage>
      )}
      {saved && !dirty && <StatusMessage tone="success">{t('options.saved')}</StatusMessage>}
      <div className="pb-stack options-actions">
        <Button type="submit" testId={TEST_IDS.optionsSave} disabled={invalid}>
          {t('options.save')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          testId={TEST_IDS.optionsBack}
          onClick={() => {
            sounds.back();
            onBack();
          }}
        >
          {backLabel}
        </Button>
      </div>
    </form>
  );
}
