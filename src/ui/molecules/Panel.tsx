import { useId, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import './Panel.css';

export type PanelSize = 'compact' | 'regular' | 'wide';
export type PanelElement = 'section' | 'div' | 'form';
export type PanelHeadingLevel = 1 | 2 | 3;

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title' | 'className' | 'children'> {
  title?: string | undefined;
  headingLevel?: PanelHeadingLevel | undefined;
  size?: PanelSize | undefined;
  as?: PanelElement | undefined;
  children?: ReactNode;
  className?: string | undefined;
  testId?: string | undefined;
  ref?: Ref<HTMLElement> | undefined;
}

function assignRef(ref: Ref<HTMLElement> | undefined, element: HTMLElement | null) {
  if (typeof ref === 'function') {
    ref(element);
  } else if (ref) {
    ref.current = element;
  }
}

export function Panel({
  title,
  headingLevel = 1,
  size = 'regular',
  as = 'section',
  children,
  className,
  testId,
  ref,
  ...rest
}: PanelProps) {
  const generatedTitleId = useId();
  const titleId = title === undefined ? undefined : `${generatedTitleId}-title`;
  const Container = as;
  const Heading = `h${headingLevel}` as const;
  const classes = ['pb-panel', `pb-panel--${size}`, className ?? ''].filter(Boolean).join(' ');

  return (
    <Container
      {...rest}
      ref={(element: HTMLElement | null) => assignRef(ref, element)}
      className={classes}
      data-testid={testId}
      aria-labelledby={rest['aria-labelledby'] ?? titleId}
    >
      <div className="pb-panel__body">
        {title === undefined ? null : (
          <Heading id={titleId} className="pb-panel__title">
            {title}
          </Heading>
        )}
        {children}
      </div>
    </Container>
  );
}
