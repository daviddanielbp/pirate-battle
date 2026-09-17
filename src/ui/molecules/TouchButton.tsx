import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { iconUrl, type IconName } from '@/ui/shared/icons';
import '../atoms/RoundButton.css';
import './TouchButton.css';

export interface TouchButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  onRelease: () => void;
  size?: number | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar']);

export function TouchButton({
  icon,
  label,
  onPress,
  onRelease,
  size = 64,
  disabled = false,
  className,
  testId,
}: TouchButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pressedRef = useRef(false);
  const keyboardPressRef = useRef(false);
  const onReleaseRef = useRef(onRelease);

  useEffect(() => {
    onReleaseRef.current = onRelease;
  }, [onRelease]);

  const release = useCallback(() => {
    if (!pressedRef.current) {
      return;
    }
    pressedRef.current = false;
    keyboardPressRef.current = false;
    setIsPressed(false);
    onReleaseRef.current();
  }, []);

  const press = useCallback(() => {
    if (pressedRef.current || disabled) {
      return;
    }
    pressedRef.current = true;
    setIsPressed(true);
    onPress();
  }, [disabled, onPress]);

  useEffect(() => release, [release]);

  useEffect(() => {
    if (disabled) {
      release();
    }
  }, [disabled, release]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    press();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!ACTIVATION_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    if (!event.repeat && !pressedRef.current) {
      keyboardPressRef.current = true;
      press();
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!ACTIVATION_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    if (keyboardPressRef.current) release();
  };

  const handleBlur = () => {
    if (keyboardPressRef.current) release();
  };

  const classes = ['pb-round', 'pb-touch-button', isPressed ? 'pb-round--pressed' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const sizeStyle = { '--pb-round-size': `${size}px` } as CSSProperties;

  return (
    <button
      type="button"
      className={classes}
      style={sizeStyle}
      aria-label={label}
      aria-pressed={isPressed}
      disabled={disabled}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleBlur}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <img className="pb-round__icon" src={iconUrl(icon)} alt="" draggable={false} />
    </button>
  );
}
