import { describe, expect, it } from "vitest";
import { Match, MatchSummary } from "@/types/match";
import {
  createDefaultSeasonName,
  getSeasonPlayerStats,
  getSeasonStats,
  migrateLegacyDataToSeasons,
} from "@/lib/seasons";

function createMatchSummary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "m1",
    myTeamName: "Goal Keeper",
    opponentName: "Rivals",
    isHome: true,
    myTeamScore: 2,
    opponentScore: 1,
    date: "1 Apr 2026",
    endedAt: 1711976400000,
    ...overrides,
  };
}

function createFullMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    myTeamName: "Goal Keeper",
    opponentName: "Rivals",
    isHome: true,
    goals: [
      {
        id: "g1",
        team: "my-team",
        scorer: "Alice",
        type: "normal",
        time: "10:00",
        timestamp: 1,
      },
      {
        id: "g2",
        team: "my-team",
        scorer: "Alice",
        type: "normal",
        time: "20:00",
        timestamp: 2,
      },
      {
        id: "g3",
        team: "opponent",
        type: "normal",
        time: "25:00",
        timestamp: 3,
      },
    ],
    events: [],
    startedAt: 1,
    endedAt: 2,
    isActive: false,
    isRunning: false,
    totalPausedTime: 0,
    currentPeriod: 4,
    ...overrides,
  };
}

describe("season helpers", () => {
  it("totals named team players across completed season matches only", () => {
    const goal = (
      id: string,
      scorer?: string,
      assist?: string,
      type: Match["goals"][number]["type"] = "normal",
      team: Match["goals"][number]["team"] = "my-team",
    ) => ({ id, scorer, assist, type, team, time: "10:00", timestamp: 1 });
    const card = (
      id: string,
      type: "yellow-card" | "red-card",
      player?: string,
      team: "my-team" | "opponent" = "my-team",
    ) => ({ id, type, player, team, time: "10:00", timestamp: 1 });
    const migrated = migrateLegacyDataToSeasons(
      [createMatchSummary(), createMatchSummary({ id: "m2" }), createMatchSummary({ id: "live" })],
      {
        m1: createFullMatch({
          goals: [
            goal("1", "Alice", "Bob"),
            goal("2", "Alice", "Bob", "penalty"),
            goal("3", "Own goal", "Outsider", "own-goal"),
            goal("4", "Opponent", "Outsider", "normal", "opponent"),
            goal("5", undefined, "Bob"),
            goal("6", "", ""),
          ],
          events: [
            card("7", "yellow-card", "Alice"),
            card("8", "red-card", "Chris"),
            card("9", "yellow-card", "Opponent", "opponent"),
            card("10", "yellow-card"),
          ],
        }),
        m2: createFullMatch({ id: "m2", goals: [goal("11", "Alice", "Bob", "head")] }),
        orphan: createFullMatch({ id: "orphan", goals: [goal("12", "Orphan")] }),
        live: createFullMatch({ id: "live", isActive: true, goals: [goal("13", "Live")] }),
      },
    );

    expect(getSeasonPlayerStats(migrated.seasons[migrated.activeSeasonId])).toEqual([
      { name: "Alice", goals: 3, assists: 0, yellowCards: 1, redCards: 0 },
      { name: "Bob", goals: 0, assists: 4, yellowCards: 0, redCards: 0 },
      { name: "Chris", goals: 0, assists: 0, yellowCards: 0, redCards: 1 },
    ]);
  });

  it("returns no player stats when completed match details are unavailable", () => {
    const migrated = migrateLegacyDataToSeasons([createMatchSummary()], {});
    expect(getSeasonPlayerStats(migrated.seasons[migrated.activeSeasonId])).toEqual([]);
  });

  it("creates default season names in YYYY-YYYY format", () => {
    const date = new Date("2026-04-25T10:00:00Z");
    expect(createDefaultSeasonName(date)).toBe("2026-2027");
  });

  it("migrates legacy history/fullMatches to a single active season", () => {
    const history = [createMatchSummary()];
    const fullMatches = { m1: createFullMatch() };
    const migrated = migrateLegacyDataToSeasons(history, fullMatches, 1711976400000);

    expect(migrated.activeSeasonId).toBeTruthy();
    expect(Object.keys(migrated.seasons)).toHaveLength(1);
    const season = migrated.seasons[migrated.activeSeasonId];
    expect(season.status).toBe("active");
    expect(season.matches).toHaveLength(1);
    expect(season.fullMatches.m1).toBeTruthy();
  });

  it("computes season summary stats with top scorer", () => {
    const migrated = migrateLegacyDataToSeasons(
      [
        createMatchSummary({ id: "m1", myTeamScore: 2, opponentScore: 1 }),
        createMatchSummary({ id: "m2", myTeamScore: 1, opponentScore: 1 }),
        createMatchSummary({ id: "m3", myTeamScore: 0, opponentScore: 2 }),
      ],
      {
        m1: createFullMatch({ id: "m1" }),
        m2: createFullMatch({
          id: "m2",
          goals: [
            {
              id: "g4",
              team: "my-team",
              scorer: "Bob",
              type: "normal",
              time: "30:00",
              timestamp: 4,
            },
          ],
        }),
        m3: createFullMatch({ id: "m3", goals: [] }),
      },
      1711976400000,
    );
    const season = migrated.seasons[migrated.activeSeasonId];
    const stats = getSeasonStats(season);

    expect(stats.wins).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.goalsFor).toBe(3);
    expect(stats.goalsAgainst).toBe(4);
    expect(stats.topScorers).toEqual(["Alice"]);
  });

  it("finds the season's top scorer and assist leader from team goals", () => {
    const goal = (
      id: string,
      scorer: string | undefined,
      assist: string | undefined,
      type: Match["goals"][number]["type"] = "normal",
      team: Match["goals"][number]["team"] = "my-team",
    ) => ({ id, scorer, assist, type, team, time: "10:00", timestamp: Number(id) });
    const migrated = migrateLegacyDataToSeasons([createMatchSummary()], {
      m1: createFullMatch({
        goals: [
          goal("1", "Alice", "Dana"),
          goal("2", "Alice", "Dana"),
          goal("3", "Alice", "Eli"),
          goal("4", "Bob", "Dana"),
          goal("5", "Bob", "Fran"),
          goal("6", "Chris", "Eli"),
          goal("7", "Drew", "Fran"),
          goal("8", "Own goal", "Outsider", "own-goal"),
          goal("9", "Opponent", "Outsider", "normal", "opponent"),
        ],
      }),
    });
    const stats = getSeasonStats(migrated.seasons[migrated.activeSeasonId]);

    expect(stats.topScorers).toEqual(["Alice"]);
    expect(stats.topScorerGoals).toBe(3);
    expect(stats.topAssisters).toEqual(["Dana"]);
    expect(stats.topAssisters).not.toContain("Outsider");
    expect(stats.topAssists).toBe(3);
  });

  it("does not count assists on own goals", () => {
    const migrated = migrateLegacyDataToSeasons([createMatchSummary()], {
      m1: createFullMatch({
        goals: [
          {
            id: "1",
            scorer: "Own goal",
            assist: "Outsider",
            type: "own-goal",
            team: "my-team",
            time: "10:00",
            timestamp: 1,
          },
        ],
      }),
    });
    const stats = getSeasonStats(migrated.seasons[migrated.activeSeasonId]);

    expect(stats.topAssisters).toEqual([]);
    expect(stats.topAssisters).not.toContain("Outsider");
    expect(stats.topAssists).toBe(0);
  });

  it("returns all players tied for top scorer or assist leader", () => {
    const goal = (id: string, scorer: string, assist: string) => ({
      id,
      scorer,
      assist,
      type: "normal" as const,
      team: "my-team" as const,
      time: "10:00",
      timestamp: Number(id),
    });
    const migrated = migrateLegacyDataToSeasons([createMatchSummary()], {
      m1: createFullMatch({
        goals: [goal("1", "Alice", "Dana"), goal("2", "Bob", "Eli")],
      }),
    });
    const stats = getSeasonStats(migrated.seasons[migrated.activeSeasonId]);

    expect(stats.topScorers).toEqual(["Alice", "Bob"]);
    expect(stats.topScorerGoals).toBe(1);
    expect(stats.topAssisters).toEqual(["Dana", "Eli"]);
    expect(stats.topAssists).toBe(1);
  });
});
