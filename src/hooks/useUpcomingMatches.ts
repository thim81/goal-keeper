import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarFixture } from '@/lib/calendar';
import { getUpcomingMatches, type UpcomingMatch } from '@/lib/upcoming-matches';

interface CalendarResponse {
  games?: CalendarFixture[];
}

interface CalendarCache {
  fetchedAt: number;
  games: CalendarFixture[];
}

const CALENDAR_CACHE_PREFIX = 'football-tracker-calendar-cache:';
const CALENDAR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

function getCacheKey(url: string) {
  return `${CALENDAR_CACHE_PREFIX}${url}`;
}

function readFreshCache(url: string): CalendarFixture[] | null {
  try {
    const raw = localStorage.getItem(getCacheKey(url));
    if (!raw) return null;

    const cache = JSON.parse(raw) as Partial<CalendarCache>;
    if (
      typeof cache.fetchedAt !== 'number' ||
      !Array.isArray(cache.games) ||
      Date.now() - cache.fetchedAt >= CALENDAR_CACHE_MAX_AGE
    ) {
      return null;
    }

    return cache.games;
  } catch {
    return null;
  }
}

function writeCache(url: string, games: CalendarFixture[]) {
  try {
    localStorage.setItem(getCacheKey(url), JSON.stringify({ fetchedAt: Date.now(), games }));
  } catch {
    // Caching is an optimization, so storage failures should not block fetching.
  }
}

export function useUpcomingMatches(
  calendarUrl: string,
  calendarTeamName: string,
  onDetectedTeamName?: (teamName: string) => void,
) {
  const [matches, setMatches] = useState<UpcomingMatch[]>([]);
  const [games, setGames] = useState<CalendarFixture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!games.length) {
      setMatches([]);
      return;
    }

    const result = getUpcomingMatches(games, calendarTeamName);
    if (!calendarTeamName.trim() && result.detectedTeamName) {
      onDetectedTeamName?.(result.detectedTeamName);
    }
    setMatches(result.matches);
  }, [calendarTeamName, games, onDetectedTeamName]);

  const refresh = useCallback(
    async (force = true) => {
      // Once we've shown a list, a later refresh (manual or automatic) should
      // keep it visible instead of hiding the card while the new data loads.
      const isRefreshOfExistingData = hasLoadedRef.current;

      if (!calendarUrl.trim()) {
        setLoaded(true);
        setMatches([]);
        setGames([]);
        hasLoadedRef.current = true;
        return;
      }

      if (!isRefreshOfExistingData) {
        setLoaded(false);
        setMatches([]);
        setGames([]);
      }

      const normalizedUrl = calendarUrl.trim();
      if (!force) {
        const cachedGames = readFreshCache(normalizedUrl);
        if (cachedGames) {
          setGames(cachedGames);
          setLoaded(true);
          hasLoadedRef.current = true;
          return;
        }
      }

      try {
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl }),
        });
        if (!response.ok) throw new Error('Calendar request failed');

        const payload = (await response.json()) as CalendarResponse;
        const nextGames = Array.isArray(payload.games) ? payload.games : [];
        writeCache(normalizedUrl, nextGames);
        setGames(nextGames);
      } catch {
        // A failed refresh of an already-loaded list keeps showing the stale
        // data rather than clearing it out from under the user.
        if (!isRefreshOfExistingData) setMatches([]);
      } finally {
        setLoaded(true);
        hasLoadedRef.current = true;
      }
    },
    [calendarUrl],
  );

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  return { matches, loaded, refresh };
}
