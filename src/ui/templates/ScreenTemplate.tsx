import type { ReactNode } from 'react';
import { SceneBackground } from './SceneBackground';
import './ScreenTemplate.css';

export interface ScreenTemplateProps {
  testId: string;
  children: ReactNode;
  className?: string | undefined;
}

export function ScreenTemplate({ testId, children, className }: ScreenTemplateProps): React.JSX.Element {
  return (
    <SceneBackground>
      <main className={className ? `pb-screen pb-screen-enter ${className}` : 'pb-screen pb-screen-enter'} data-testid={testId}>
        {children}
      </main>
    </SceneBackground>
  );
}
