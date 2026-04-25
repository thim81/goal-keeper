import { SyncState } from '@/lib/sync';

export interface BackupPayloadV1 {
  version: 1;
  exportedAt: string;
  state: SyncState;
}

export type ParsedBackup =
  | { ok: true; state: SyncState }
  | { ok: false; error: string };

export function buildBackupPayload(
  state: SyncState,
  exportedAt: string = new Date().toISOString(),
): BackupPayloadV1 {
  return {
    version: 1,
    exportedAt,
    state,
  };
}

export function parseBackupPayload(text: string): ParsedBackup {
  try {
    const raw = JSON.parse(text) as Partial<BackupPayloadV1>;
    if (raw.version !== 1 || !raw.state || typeof raw.state !== 'object') {
      return { ok: false, error: 'Invalid backup format' };
    }

    const state = raw.state as SyncState;
    if (!state.settings || typeof state.settings !== 'object') {
      return { ok: false, error: 'Backup is missing settings' };
    }

    return { ok: true, state };
  } catch {
    return { ok: false, error: 'Backup file is not valid JSON' };
  }
}
