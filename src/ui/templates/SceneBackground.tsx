import type { ReactNode } from 'react';
import './SceneBackground.css';

export interface SceneBackgroundProps {
  children?: ReactNode;
  dimmed?: boolean | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function SceneBackground({ children, dimmed = false, className, testId }: SceneBackgroundProps) {
  const classes = ['pb-scene', dimmed ? 'pb-scene--dimmed' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={classes} data-testid={testId}>
      <div className="pb-scene__image" aria-hidden="true" />
      <div className="pb-scene__vignette" aria-hidden="true" />
      <div className="pb-scene__content">{children}</div>
    </div>
  );
}
