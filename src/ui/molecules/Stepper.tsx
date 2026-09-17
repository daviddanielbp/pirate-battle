import { useId, type KeyboardEvent } from 'react';
import { IconButton } from '@/ui/atoms/IconButton';
import './Stepper.css';

export interface StepperTestIds {
  value?: string | undefined;
  decrease?: string | undefined;
  increase?: string | undefined;
}

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | undefined;
  unit?: string | undefined;
  onChange: (value: number) => void;
  decreaseLabel?: string | undefined;
  increaseLabel?: string | undefined;
  testIds?: StepperTestIds | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

const PRECISION = 1_000_000;

function clampToRange(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)) * PRECISION) / PRECISION;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  decreaseLabel,
  increaseLabel,
  testIds,
  error,
  disabled = false,
  className,
  testId,
}: StepperProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  const commit = (next: number) => {
    const clamped = clampToRange(next, min, max);
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLOutputElement>) => {
    if (disabled) {
      return;
    }
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        commit(value + step);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        commit(value - step);
        break;
      case 'PageUp':
        commit(value + step * 10);
        break;
      case 'PageDown':
        commit(value - step * 10);
        break;
      case 'Home':
        commit(min);
        break;
      case 'End':
        commit(max);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const valueText = unit === undefined ? `${value}` : `${value} ${unit}`;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={error === undefined ? undefined : errorId}
      className={['pb-stepper', error === undefined ? '' : 'pb-stepper--error', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
    >
      <span id={labelId} className="pb-stepper__label">
        {label}
      </span>
      <div className="pb-stepper__controls">
        <IconButton
          icon="minus"
          label={decreaseLabel ?? `Decrease ${label}`}
          size={48}
          disabled={!canDecrease}
          testId={testIds?.decrease}
          onClick={() => commit(value - step)}
        />
        <output
          role="spinbutton"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={labelId}
          aria-describedby={error === undefined ? undefined : errorId}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-invalid={error === undefined ? undefined : true}
          aria-disabled={disabled ? true : undefined}
          aria-live="polite"
          className="pb-stepper__value pb-number"
          data-testid={testIds?.value}
          onKeyDown={handleKeyDown}
        >
          {valueText}
        </output>
        <IconButton
          icon="plus"
          label={increaseLabel ?? `Increase ${label}`}
          size={48}
          disabled={!canIncrease}
          testId={testIds?.increase}
          onClick={() => commit(value + step)}
        />
      </div>
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="pb-stepper__error">
          {error}
        </p>
      )}
    </div>
  );
}
