import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'regular' | 'small';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  children: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
}

export function Button({
  variant = 'primary',
  size = 'regular',
  type = 'button',
  children,
  className,
  testId,
  ref,
  ...rest
}: ButtonProps) {
  const classes = ['pb-button', `pb-button--${variant}`, `pb-button--${size}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} ref={ref} type={type} className={classes} data-testid={testId}>
      <span className="pb-button__label">{children}</span>
    </button>
  );
}
