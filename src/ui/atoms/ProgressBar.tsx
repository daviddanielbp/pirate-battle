import './ProgressBar.css';

export interface ProgressBarProps {
  value: number;
  label: string;
  showValue?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function ProgressBar({ value, label, showValue = true, className, testId }: ProgressBarProps) {
  const fraction = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(fraction * 100);

  return (
    <div className={['pb-progress', className ?? ''].filter(Boolean).join(' ')} data-testid={testId}>
      <div className="pb-progress__header">
        <span className="pb-progress__label">{label}</span>
        {showValue ? (
          <span className="pb-progress__value pb-number" aria-hidden="true">
            {percent}%
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        className="pb-progress__track"
      >
        <div className="pb-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
