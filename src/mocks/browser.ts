import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

let startup: Promise<void> | null = null;

export function startMockWorker(): Promise<void> {
  startup ??= setupWorker(...handlers)
    .start({ onUnhandledRequest: 'bypass', quiet: true, serviceWorker: { url: '/mockServiceWorker.js' } })
    .then(() => undefined);
  return startup;
}
