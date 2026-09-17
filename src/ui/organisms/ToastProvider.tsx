import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastApi, type ToastInput } from '@/app/toastContext';
import { StatusMessage } from '@/ui/atoms/StatusMessage';
import './ToastProvider.css';

interface ToastItem extends ToastInput {
  key: string;
  createdAt: number;
}

const DEFAULT_DURATION_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(key);
    setToasts((current) => current.filter((toast) => toast.key !== key));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const key = input.id ?? `toast-${counter.current}`;
      const item: ToastItem = { ...input, key, createdAt: counter.current };
      setToasts((current) => [...current.filter((toast) => toast.key !== key), item]);
      const existing = timers.current.get(key);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.current.set(
        key,
        window.setTimeout(() => dismiss(key), input.durationMs ?? DEFAULT_DURATION_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pb-toasts" aria-live="polite" aria-relevant="additions">
          {toasts.map((toast) => (
            <div key={`${toast.key}-${toast.createdAt}`} className="pb-toast">
              <button type="button" className="pb-toast__dismiss" onClick={() => dismiss(toast.key)}>
                <StatusMessage tone={toast.tone ?? 'info'} testId={toast.testId}>
                  {toast.message}
                </StatusMessage>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
