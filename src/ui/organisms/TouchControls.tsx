import { useTranslation } from '@/app/useTranslation';
import type { ControlAction, ControlState } from '@/game/input/controls';
import type { MessageKey } from '@/i18n';
import { TEST_IDS } from '@/testing/testIds';
import { TouchButton } from '@/ui';
import { useMediaQuery } from '@/app/useMediaQuery';
import './TouchControls.css';

export interface TouchControlsProps {
  controls: ControlState;
  disabled: boolean;
}

interface TouchSpec {
  action: ControlAction;
  icon: 'forward' | 'turnLeft' | 'turnRight' | 'fireFront' | 'fireLeft' | 'fireRight';
  label: MessageKey;
  testId: string;
}

const LEFT_CLUSTER: TouchSpec[] = [
  { action: 'turnLeft', icon: 'turnLeft', label: 'touch.turnLeft', testId: TEST_IDS.touchTurnLeft },
  { action: 'forward', icon: 'forward', label: 'touch.forward', testId: TEST_IDS.touchForward },
  { action: 'turnRight', icon: 'turnRight', label: 'touch.turnRight', testId: TEST_IDS.touchTurnRight },
];

const RIGHT_CLUSTER: TouchSpec[] = [
  { action: 'fireLeft', icon: 'fireLeft', label: 'touch.firePort', testId: TEST_IDS.touchFireLeft },
  { action: 'fireFront', icon: 'fireFront', label: 'touch.fireFront', testId: TEST_IDS.touchFireFront },
  {
    action: 'fireRight',
    icon: 'fireRight',
    label: 'touch.fireStarboard',
    testId: TEST_IDS.touchFireRight,
  },
];

const NARROW_QUERY = '(max-width: 520px)';

export function TouchControls({ controls, disabled }: TouchControlsProps): React.JSX.Element {
  const narrow = useMediaQuery(NARROW_QUERY);
  const size = narrow ? 46 : 60;
  const { t } = useTranslation();
  const render = (spec: TouchSpec): React.JSX.Element => (
    <TouchButton
      key={spec.action}
      icon={spec.icon}
      label={t(spec.label)}
      testId={spec.testId}
      disabled={disabled}
      size={size}
      onPress={() => controls.press(spec.action)}
      onRelease={() => controls.release(spec.action)}
    />
  );
  return (
    <div className="touch-controls" aria-label={t('touch.label')} role="group">
      <div className="touch-cluster touch-cluster-left">{LEFT_CLUSTER.map(render)}</div>
      <div className="touch-cluster touch-cluster-right">{RIGHT_CLUSTER.map(render)}</div>
    </div>
  );
}
