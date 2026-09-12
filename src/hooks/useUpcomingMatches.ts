import { useCallback, useEffect, useState } from 'react';
import type { CalendarFixture } from '@/lib/calendar';
import { getUpcomingMatches, type UpcomingMatch } from '@/lib/upcoming-matches';

interface CalendarResponse {
  games?: CalendarFixture[];
}

export function useUpcomingMatches(
  calendarUrl: string,
  calendarTeamName: string,
  onDetectedTeamName?: (teamName: string) => void,
) {
  const [matches, setMatches] = useState<UpcomingMatch[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setLoaded(false);
    setMatches([]);

    if (!calendarUrl.trim()) {
      setLoaded(true);
      return;
    }

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: calendarUrl.trim() }),
      });
      if (!response.ok) throw new Error('Calendar request failed');

      const payload = (await response.json()) as CalendarResponse;
      const games = Array.isArray(payload.games) ? payload.games : [];
      const result = getUpcomingMatches(games, calendarTeamName);

      if (!calendarTeamName.trim() && result.detectedTeamName) {
        onDetectedTeamName?.(result.detectedTeamName);
      }
      setMatches(result.matches);
    } catch {
      setMatches([]);
    } finally {
      setLoaded(true);
    }
  }, [calendarTeamName, calendarUrl, onDetectedTeamName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { matches, loaded, refresh };
}
