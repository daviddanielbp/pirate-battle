import { clear as clearPendingSubmissions } from '@/data/pendingSubmissions';
import { queryClient } from '@/data/queryClient';
import { invalidateLogQueries } from '@/data/queryKeys';
import { resetMockState } from './handlers';
import {
  getActiveScenarioId,
  NETWORK_SCENARIOS,
  resetScenario,
  resetScenarioCounters,
  setActiveScenarioId,
} from './scenarios';
import type { NetworkScenario, ScenarioId } from './scenarios';

export { getActiveScenarioId };

export function listScenarios(): readonly NetworkScenario[] {
  return NETWORK_SCENARIOS;
}

export function applyScenario(id: ScenarioId): void {
  setActiveScenarioId(id);
  resetScenarioCounters();
  void invalidateLogQueries(queryClient);
}

export function resetEverything(): void {
  resetMockState();
  resetScenario();
  clearPendingSubmissions();
  queryClient.clear();
}
