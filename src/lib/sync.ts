import { Match, MatchSummary, Season } from '@/types/match';

export interface SyncState {
  matches: MatchSummary[];
  activeMatch: Match | null;
  fullMatches: Record<string, Match>;
  seasons?: Record<string, Season>;
  activeSeasonId?: string;
  settings: any;
}

export async function fetchRemoteState(token: string): Promise<SyncState | null> {
  try {
    const response = await fetch('/api/state', {
      headers: {
        'x-auth-token': token,
      },
    });

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch remote state');
    }

    return await response.json();
  } catch (error) {
    console.error('Sync fetch error:', error);
    return null;
  }
}

export async function pushLocalState(token: string, state: SyncState): Promise<boolean> {
  try {
    const response = await fetch('/api/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token,
      },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      throw new Error('Failed to push local state');
    }

    return true;
  } catch (error) {
    console.error('Sync push error:', error);
    return false;
  }
}
