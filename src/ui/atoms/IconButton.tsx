import type { ButtonHTMLAttributes, CSSProperties, Ref } from 'react';
import { iconUrl, type IconName } from '@/ui/shared/icons';
import './RoundButton.css';
import './IconButton.css';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'aria-label' | 'aria-pressed'
> {
  icon: IconName;
  label: string;
  size?: number | undefined;
  pressed?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
}

export function IconButton({
  icon,
  label,
  size = 56,
  pressed,
  type = 'button',
  className,
  testId,
  ref,
  style,
  ...rest
}: IconButtonProps) {
  const classes = ['pb-round', 'pb-icon-button', pressed ? 'pb-round--pressed' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const sizeStyle: CSSProperties = { ...style, '--pb-round-size': `${size}px` } as CSSProperties;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      style={sizeStyle}
      aria-label={label}
      aria-pressed={pressed}
      title={rest.title ?? label}
      data-testid={testId}
    >
      <img className="pb-round__icon" src={iconUrl(icon)} alt="" draggable={false} />
    </button>
  );
}
