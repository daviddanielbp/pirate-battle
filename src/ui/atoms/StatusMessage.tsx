import type { ReactNode } from 'react';
import './StatusMessage.css';

export type StatusTone = 'info' | 'success' | 'warning' | 'danger';

export interface StatusMessageProps {
  tone?: StatusTone | undefined;
  children: ReactNode;
  id?: string | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function StatusMessage({ tone = 'info', children, id, className, testId }: StatusMessageProps) {
  return (
    <div
      id={id}
      role={tone === 'danger' ? 'alert' : 'status'}
      className={['pb-status', `pb-status--${tone}`, className ?? ''].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <span className="pb-status__dot" aria-hidden="true" />
      <span className="pb-status__text">{children}</span>
    </div>
  );
}
