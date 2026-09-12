import type { CalendarFixture } from './calendar';

export interface UpcomingMatch extends CalendarFixture {
  opponentName: string;
  isHome: boolean;
}

export function getUpcomingMatches(
  fixtures: CalendarFixture[],
  configuredTeamName: string,
  limit = 3,
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
