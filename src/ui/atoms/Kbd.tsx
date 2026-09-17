import type { ReactNode } from 'react';
import './Kbd.css';

export interface KbdProps {
  children: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Kbd({ children, className, testId }: KbdProps) {
  return (
    <kbd className={['pb-kbd', className ?? ''].filter(Boolean).join(' ')} data-testid={testId}>
      {children}
    </kbd>
  );
}
