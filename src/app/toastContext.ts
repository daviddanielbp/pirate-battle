import { createContext, useContext } from 'react';
import type { StatusTone } from '@/ui/atoms/StatusMessage';

export interface ToastInput {
  id?: string | undefined;
  tone?: StatusTone | undefined;
  message: string;
  testId?: string | undefined;
  durationMs?: number | undefined;
}

export interface ToastApi {
  show: (toast: ToastInput) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('Toast context is not available');
  return api;
}
