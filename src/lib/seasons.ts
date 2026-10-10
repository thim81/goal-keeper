import { MatchSummary, Season } from "@/types/match";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createDefaultSeasonName(value: Date | number = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  return `${year}-${year + 1}`;
}

export function migrateLegacyDataToSeasons(
  legacyMatches: MatchSummary[],
  legacyFullMatches: Season["fullMatches"],
  now: number = Date.now(),
): { seasons: Record<string, Season>; activeSeasonId: string } {
  const seasonId = generateId();
  const season: Season = {
    id: seasonId,
    name: createDefaultSeasonName(now),
    startAt: now,
    status: "active",
    matches: legacyMatches,
    fullMatches: legacyFullMatches,
  };

  return {
    seasons: { [seasonId]: season },
    activeSeasonId: seasonId,
  };
}

export interface SeasonStats {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorers: string[];
  topScorerGoals: number;
  topAssisters: string[];
  topAssists: number;
}

export function getSeasonStats(season: Season): SeasonStats {
  const summary = season.matches.reduce(
    (acc, match) => {
      acc.matches += 1;
      acc.goalsFor += match.myTeamScore;
      acc.goalsAgainst += match.opponentScore;
      if (match.myTeamScore > match.opponentScore) acc.wins += 1;
      else if (match.myTeamScore < match.opponentScore) acc.losses += 1;
      else acc.draws += 1;
      return acc;
    },
    {
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    },
  );

  const scorerCounts: Record<string, number> = {};
  const assistCounts: Record<string, number> = {};
  for (const match of Object.values(season.fullMatches)) {
    for (const goal of match.goals) {
      if (goal.team === "my-team" && goal.type !== "own-goal" && goal.scorer) {
        scorerCounts[goal.scorer] = (scorerCounts[goal.scorer] || 0) + 1;
      }
      if (goal.team === "my-team" && goal.type !== "own-goal" && goal.assist) {
        assistCounts[goal.assist] = (assistCounts[goal.assist] || 0) + 1;
      }
    }
  }

  const getTopLeaders = (counts: Record<string, number>) => {
    let leaders: string[] = [];
    let count = 0;

    for (const [name, value] of Object.entries(counts)) {
      if (value > count) {
        leaders = [name];
        count = value;
      } else if (value === count && value > 0) {
        leaders.push(name);
      }
    }

    return { names: leaders, count };
  };
  const topScorer = getTopLeaders(scorerCounts);
  const topAssister = getTopLeaders(assistCounts);

  return {
    ...summary,
    topScorers: topScorer.names,
    topScorerGoals: topScorer.count,
    topAssisters: topAssister.names,
    topAssists: topAssister.count,
  };
}
