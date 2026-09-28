import { CALENDAR_GAME_GRACE_PERIOD_MS, type CalendarFixture } from "./calendar";

export const UPCOMING_MATCH_COUNTDOWN_WINDOW_MS = 60 * 60 * 1000;
export const UPCOMING_MATCH_COUNTDOWN_GRACE_MS = 15 * 60 * 1000;

export interface UpcomingMatch extends CalendarFixture {
  opponentName: string;
  isHome: boolean;
}

export function getUpcomingMatchCountdown(
  matches: UpcomingMatch[],
  now: number = Date.now(),
): { match: UpcomingMatch; secondsRemaining: number } | null {
  const next = matches
    .map((match) => ({ match, start: new Date(match.start).getTime() }))
    .filter(
      ({ start }) => Number.isFinite(start) && start >= now - UPCOMING_MATCH_COUNTDOWN_GRACE_MS,
    )
    .sort((a, b) => a.start - b.start)[0];

  if (!next || next.start - now > UPCOMING_MATCH_COUNTDOWN_WINDOW_MS) return null;

  return {
    match: next.match,
    secondsRemaining: Math.max(0, Math.ceil((next.start - now) / 1000)),
  };
}

export function getUpcomingMatches(
  fixtures: CalendarFixture[],
  configuredTeamName: string,
  limit = 3,
  now: Date = new Date(),
): { matches: UpcomingMatch[]; detectedTeamName: string | null } {
  const configured = configuredTeamName.trim();
  const detected = configured
    ? null
    : (fixtures
        .flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam])
        .find((team) => /^IPU[\p{L}\p{N}_-]*$/iu.test(team)) ?? null);
  const teamName = configured || detected;

  if (!teamName) return { matches: [], detectedTeamName: null };

  const normalizedTeamName = teamName.toLocaleLowerCase();
  const matches = fixtures
    .filter(
      (fixture) =>
        new Date(fixture.start).getTime() >= now.getTime() - CALENDAR_GAME_GRACE_PERIOD_MS,
    )
    .flatMap((fixture): UpcomingMatch[] => {
      const isHomeTeam = fixture.homeTeam.toLocaleLowerCase() === normalizedTeamName;
      const isAwayTeam = fixture.awayTeam.toLocaleLowerCase() === normalizedTeamName;
      if (!isHomeTeam && !isAwayTeam) return [];

      return [
        {
          ...fixture,
          opponentName: isHomeTeam ? fixture.awayTeam : fixture.homeTeam,
          isHome: isHomeTeam,
        },
      ];
    })
    .slice(0, limit);

  return { matches, detectedTeamName: detected };
}
