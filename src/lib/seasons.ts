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

export interface SeasonPlayerStats {
  name: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export function getSeasonPlayerStats(season: Season): SeasonPlayerStats[] {
  const players = new Map<string, SeasonPlayerStats>();
  const getPlayer = (name?: string) => {
    const trimmedName = name?.trim();
    if (!trimmedName) return;
    if (!players.has(trimmedName)) {
      players.set(trimmedName, {
        name: trimmedName,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
      });
    }
    return players.get(trimmedName)!;
  };

  for (const summary of season.matches) {
    const match = season.fullMatches[summary.id];
    if (!match || match.isActive) continue;
    for (const goal of match.goals) {
      if (goal.team !== "my-team" || goal.type === "own-goal") continue;
      const scorer = getPlayer(goal.scorer);
      const assister = getPlayer(goal.assist);
      if (scorer) scorer.goals += 1;
      if (assister) assister.assists += 1;
    }
    for (const event of match.events) {
      if (event.team !== "my-team" || (event.type !== "yellow-card" && event.type !== "red-card"))
        continue;
      const player = getPlayer(event.player);
      if (!player) continue;
      if (event.type === "yellow-card") player.yellowCards += 1;
      else player.redCards += 1;
    }
  }

  return [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
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

  const playerStats = getSeasonPlayerStats(season);
  const getTopLeaders = (field: "goals" | "assists") => {
    let leaders: string[] = [];
    let count = 0;

    for (const player of playerStats) {
      const value = player[field];
      if (value > count) {
        leaders = [player.name];
        count = value;
      } else if (value === count && value > 0) {
        leaders.push(player.name);
      }
    }

    return { names: leaders, count };
  };
  const topScorer = getTopLeaders("goals");
  const topAssister = getTopLeaders("assists");

  return {
    ...summary,
    topScorers: topScorer.names,
    topScorerGoals: topScorer.count,
    topAssisters: topAssister.names,
    topAssists: topAssister.count,
  };
}
