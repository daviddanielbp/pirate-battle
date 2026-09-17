import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { getFocusableElements } from '@/ui/shared/focusable';
import { Panel, type PanelSize } from '@/ui/molecules/Panel';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose?: (() => void) | undefined;
  initialFocusRef?: RefObject<HTMLElement | null> | undefined;
  size?: PanelSize | undefined;
  className?: string | undefined;
  testId?: string | undefined;
}

export function Dialog({ open, ...surfaceProps }: DialogProps) {
  if (!open) {
    return null;
  }
  return createPortal(<DialogSurface {...surfaceProps} />, document.body);
}

type DialogSurfaceProps = Omit<DialogProps, 'open'>;

function DialogSurface({
  title,
  children,
  onClose,
  initialFocusRef,
  size = 'compact',
  className,
  testId,
}: DialogSurfaceProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (root) root.inert = true;

    const panel = panelRef.current;
    const focusInside = (): void => {
      const target = panel ? (getFocusableElements(panel)[0] ?? panel) : null;
      target?.focus({ preventScroll: true });
    };
    const initialTarget = initialFocusRef?.current ?? null;
    if (initialTarget) initialTarget.focus({ preventScroll: true });
    else focusInside();

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (!panel) return;
      if (event.key === 'Escape') {
        if (onCloseRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent): void => {
      if (panel && event.target instanceof Node && !panel.contains(event.target)) focusInside();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previousBodyOverflow;
      if (root) root.inert = previousInert;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [initialFocusRef]);

  const keepFocus = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) event.preventDefault();
  };

  return (
    <div className="pb-dialog-backdrop" onMouseDown={keepFocus}>
      <Panel
        ref={panelRef}
        as="div"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        size={size}
        title={title}
        headingLevel={2}
        className={['pb-dialog', className ?? ''].filter(Boolean).join(' ')}
        testId={testId}
      >
        {children}
      </Panel>
    </div>
  );
}
