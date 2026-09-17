import { useId } from 'react';
import './Toggle.css';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Toggle({
  label,
  checked,
  onChange,
  description,
  disabled = false,
  className,
  testId,
}: ToggleProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const descriptionId = `${baseId}-description`;

  return (
    <div className={['pb-toggle', className ?? ''].filter(Boolean).join(' ')}>
      <div className="pb-toggle__text">
        <span id={labelId} className="pb-toggle__label">
          {label}
        </span>
        {description === undefined ? null : (
          <span id={descriptionId} className="pb-toggle__description">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description === undefined ? undefined : descriptionId}
        disabled={disabled}
        className="pb-toggle__switch"
        data-testid={testId}
        onClick={() => onChange(!checked)}
      >
        <span className="pb-toggle__knob" aria-hidden="true" />
      </button>
    </div>
  );
}
