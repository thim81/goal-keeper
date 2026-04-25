import { describe, expect, it } from 'vitest';
import { buildBackupPayload, parseBackupPayload } from '@/lib/backup';
import { AppSettings, DEFAULT_SETTINGS, Season } from '@/types/match';
import { SyncState } from '@/lib/sync';

function createSyncState(): SyncState {
  const seasonId = 's1';
  const seasons: Record<string, Season> = {
    [seasonId]: {
      id: seasonId,
      name: '2026-2027',
      startAt: 1,
      status: 'active',
      matches: [],
      fullMatches: {},
    },
  };

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    teamName: 'Goal Keeper',
  };

  return {
    matches: [],
    fullMatches: {},
    seasons,
    activeSeasonId: seasonId,
    activeMatch: null,
    settings,
  };
}

describe('backup helpers', () => {
  it('builds a versioned backup payload', () => {
    const state = createSyncState();
    const payload = buildBackupPayload(state, '2026-04-25T10:00:00.000Z');

    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe('2026-04-25T10:00:00.000Z');
    expect(payload.state.activeSeasonId).toBe('s1');
  });

  it('parses a valid backup payload', () => {
    const state = createSyncState();
    const text = JSON.stringify(buildBackupPayload(state, '2026-04-25T10:00:00.000Z'));
    const parsed = parseBackupPayload(text);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('expected parsed backup');
    expect(parsed.state.settings.teamName).toBe('Goal Keeper');
  });

  it('rejects invalid payload', () => {
    const parsed = parseBackupPayload('{"foo":"bar"}');

    expect(parsed.ok).toBe(false);
  });
});
