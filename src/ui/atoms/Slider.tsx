import { useId, type CSSProperties } from 'react';
import './Slider.css';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | undefined;
  onChange: (value: number) => void;
  valueText?: string | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueText,
  disabled = false,
  className,
  testId,
}: SliderProps) {
  const inputId = `${useId()}-slider`;
  const range = max - min;
  const fillPercent = range <= 0 ? 0 : Math.min(100, Math.max(0, ((value - min) / range) * 100));
  const fillStyle = { '--pb-slider-fill': `${fillPercent}%` } as CSSProperties;

  return (
    <div className={['pb-slider', className ?? ''].filter(Boolean).join(' ')}>
      <div className="pb-slider__header">
        <label htmlFor={inputId} className="pb-slider__label">
          {label}
        </label>
        <span className="pb-slider__value pb-number" aria-hidden="true">
          {value}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        className="pb-slider__input"
        style={fillStyle}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={valueText ?? `${value}`}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}
