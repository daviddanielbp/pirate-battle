import type { MatchConfigSnapshot, MatchRecord } from '@/data/contracts';
import type { EndReason } from '@/game/core/entities';

interface Captain {
  id: string;
  name: string;
}

export const DEFAULT_FIXTURE_CONFIG: MatchConfigSnapshot = { sessionSeconds: 120, spawnIntervalSeconds: 3 };
const SHORT_SESSION_CONFIG: MatchConfigSnapshot = { sessionSeconds: 60, spawnIntervalSeconds: 3 };
const LONG_SESSION_CONFIG: MatchConfigSnapshot = { sessionSeconds: 180, spawnIntervalSeconds: 3 };
const SPARSE_SPAWN_CONFIG: MatchConfigSnapshot = { sessionSeconds: 120, spawnIntervalSeconds: 5 };

const CAPTAINS = {
  blackbeard: { id: 'captain-blackbeard', name: 'Blackbeard' },
  anneBonny: { id: 'captain-anne-bonny', name: 'Anne Bonny' },
  calicoJack: { id: 'captain-calico-jack', name: 'Calico Jack' },
  maryRead: { id: 'captain-mary-read', name: 'Mary Read' },
  bartholomewRoberts: { id: 'captain-bartholomew-roberts', name: 'Bartholomew Roberts' },
  henryMorgan: { id: 'captain-henry-morgan', name: 'Henry Morgan' },
  chingShih: { id: 'captain-ching-shih', name: 'Ching Shih' },
  charlesVane: { id: 'captain-charles-vane', name: 'Charles Vane' },
  stedeBonnet: { id: 'captain-stede-bonnet', name: 'Stede Bonnet' },
  edwardLow: { id: 'captain-edward-low', name: 'Edward Low' },
  graceOMalley: { id: 'captain-grace-omalley', name: "Grace O'Malley" },
  williamKidd: { id: 'captain-william-kidd', name: 'William Kidd' },
  jeanLafitte: { id: 'captain-jean-lafitte', name: 'Jean Lafitte' },
  francisDrake: { id: 'captain-francis-drake', name: 'Francis Drake' },
} satisfies Record<string, Captain>;

const EXTRA_CAPTAIN_NAMES = [
  'Black Bart',
  'Olivier Levasseur',
  'Samuel Bellamy',
  'Thomas Tew',
  'Howell Davis',
  'Benjamin Hornigold',
  'Edward England',
  'Christopher Condent',
  'Rachel Wall',
  'Jacquotte Delahaye',
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function record(
  sequence: number,
  captain: Captain,
  score: number,
  durationSeconds: number,
  endReason: EndReason,
  playedAt: string,
  config: MatchConfigSnapshot = DEFAULT_FIXTURE_CONFIG,
): MatchRecord {
  return {
    id: `fixture-${String(sequence).padStart(3, '0')}`,
    playerId: captain.id,
    playerName: captain.name,
    playedAt,
    score,
    durationSeconds,
    endReason,
    config,
  };
}

export const FIXTURE_RECORDS: readonly MatchRecord[] = [
  record(1, CAPTAINS.blackbeard, 29, 120, 'time_up', '2026-09-02T18:20:00.000Z'),
  record(2, CAPTAINS.anneBonny, 29, 97.4, 'defeated', '2026-09-04T20:05:00.000Z'),
  record(3, CAPTAINS.calicoJack, 26, 120, 'time_up', '2026-09-06T14:40:00.000Z'),
  record(4, CAPTAINS.maryRead, 26, 120, 'time_up', '2026-09-01T09:15:00.000Z'),
  record(5, CAPTAINS.bartholomewRoberts, 24, 112.6, 'defeated', '2026-09-07T21:30:00.000Z'),
  record(6, CAPTAINS.blackbeard, 24, 120, 'time_up', '2026-09-03T17:10:00.000Z'),
  record(7, CAPTAINS.henryMorgan, 23, 120, 'time_up', '2026-09-08T11:00:00.000Z'),
  record(8, CAPTAINS.calicoJack, 22, 88.2, 'defeated', '2026-09-02T22:45:00.000Z'),
  record(9, CAPTAINS.chingShih, 21, 120, 'time_up', '2026-09-09T08:30:00.000Z'),
  record(10, CAPTAINS.charlesVane, 20, 120, 'time_up', '2026-09-03T15:00:00.000Z'),
  record(11, CAPTAINS.stedeBonnet, 20, 120, 'time_up', '2026-09-05T16:20:00.000Z'),
  record(12, CAPTAINS.maryRead, 19, 73.9, 'defeated', '2026-09-04T10:05:00.000Z'),
  record(13, CAPTAINS.edwardLow, 17, 65.1, 'defeated', '2026-09-06T19:50:00.000Z'),
  record(14, CAPTAINS.graceOMalley, 16, 120, 'time_up', '2026-09-10T12:10:00.000Z'),
  record(15, CAPTAINS.blackbeard, 14, 54.3, 'defeated', '2026-09-01T20:00:00.000Z'),
  record(16, CAPTAINS.williamKidd, 13, 120, 'time_up', '2026-09-11T13:25:00.000Z'),
  record(17, CAPTAINS.henryMorgan, 12, 47.8, 'defeated', '2026-09-05T09:40:00.000Z'),
  record(18, CAPTAINS.anneBonny, 10, 120, 'time_up', '2026-09-01T12:30:00.000Z'),
  record(19, CAPTAINS.jeanLafitte, 12, 60, 'time_up', '2026-09-08T07:45:00.000Z', SHORT_SESSION_CONFIG),
  record(20, CAPTAINS.anneBonny, 12, 60, 'time_up', '2026-09-09T18:15:00.000Z', SHORT_SESSION_CONFIG),
  record(21, CAPTAINS.francisDrake, 9, 41.7, 'defeated', '2026-09-10T20:30:00.000Z', SHORT_SESSION_CONFIG),
  record(22, CAPTAINS.blackbeard, 43, 180, 'time_up', '2026-09-12T19:00:00.000Z', LONG_SESSION_CONFIG),
  record(23, CAPTAINS.chingShih, 40, 180, 'time_up', '2026-09-13T10:20:00.000Z', LONG_SESSION_CONFIG),
  record(24, CAPTAINS.henryMorgan, 34, 151.2, 'defeated', '2026-09-14T16:45:00.000Z', LONG_SESSION_CONFIG),
  record(25, CAPTAINS.calicoJack, 17, 120, 'time_up', '2026-09-15T11:35:00.000Z', SPARSE_SPAWN_CONFIG),
  record(26, CAPTAINS.graceOMalley, 16, 120, 'time_up', '2026-09-16T09:05:00.000Z', SPARSE_SPAWN_CONFIG),
];

export const EMPTY_FIXTURES: MatchRecord[] = [];

const PAGINATION_HISTORY_LENGTH = 12;

function paginationDate(day: number, hour: number): string {
  return `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

export function paginationFixtures(localPlayerId: string, localPlayerName: string): MatchRecord[] {
  const localPlayer: Captain = { id: localPlayerId, name: localPlayerName };
  const captainRecords = EXTRA_CAPTAIN_NAMES.map((name, index) => {
    const captain: Captain = { id: `captain-${slug(name)}`, name };
    return record(
      100 + index,
      captain,
      8 + index,
      120,
      'time_up',
      paginationDate(1 + index, 9 + index),
    );
  });
  const localRecords = Array.from({ length: PAGINATION_HISTORY_LENGTH }, (_, index) => {
    const defeated = index % 3 === 2;
    return record(
      200 + index,
      localPlayer,
      6 + ((index * 7) % 13),
      defeated ? 40 + index * 5 : 120,
      defeated ? 'defeated' : 'time_up',
      paginationDate(1 + index, 20),
    );
  });
  return [...captainRecords, ...localRecords];
}
