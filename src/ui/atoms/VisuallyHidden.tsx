import type { ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
  id?: string | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function VisuallyHidden({ children, id, className, testId }: VisuallyHiddenProps) {
  return (
    <span id={id} className={['pb-sr-only', className ?? ''].filter(Boolean).join(' ')} data-testid={testId}>
      {children}
    </span>
  );
}
