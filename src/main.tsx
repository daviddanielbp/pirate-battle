import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { App } from '@/app/App';
import { startMockWorker } from '@/mocks/browser';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) return;
  await startMockWorker().catch(() => undefined);
  renderApp(container);
}

function renderApp(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
