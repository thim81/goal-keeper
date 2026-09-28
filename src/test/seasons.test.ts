import { describe, expect, it } from "vitest";
import { Match, MatchSummary } from "@/types/match";
import {
  closeSeasonAndCreateNext,
  createDefaultSeasonName,
  getSeasonStats,
  migrateLegacyDataToSeasons,
  renameSeason,
  reopenSeasonAsActive,
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

  it("closes active season and creates a fresh active one", () => {
    const migrated = migrateLegacyDataToSeasons(
      [createMatchSummary()],
      { m1: createFullMatch() },
      1711976400000,
    );

    const next = closeSeasonAndCreateNext(
      migrated.seasons,
      migrated.activeSeasonId,
      "2027-2028",
      1711976401000,
    );

    expect(next.activeSeasonId).not.toBe(migrated.activeSeasonId);
    const closed = next.seasons[migrated.activeSeasonId];
    const active = next.seasons[next.activeSeasonId];
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toBe(1711976401000);
    expect(active.status).toBe("active");
    expect(active.name).toBe("2027-2028");
    expect(active.matches).toHaveLength(0);
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
    const migrated = migrateLegacyDataToSeasons(
      [createMatchSummary()],
      {
        m1: createFullMatch({
          goals: [
            goal("1", "Alice", "Dana"),
            goal("2", "Bob", "Eli"),
          ],
        }),
      },
    );
    const stats = getSeasonStats(migrated.seasons[migrated.activeSeasonId]);

    expect(stats.topScorers).toEqual(["Alice", "Bob"]);
    expect(stats.topScorerGoals).toBe(1);
    expect(stats.topAssisters).toEqual(["Dana", "Eli"]);
    expect(stats.topAssists).toBe(1);
  });

  it("reopens a closed season and closes the previously active season", () => {
    const migrated = migrateLegacyDataToSeasons(
      [createMatchSummary()],
      { m1: createFullMatch() },
      1711976400000,
    );
    const rolled = closeSeasonAndCreateNext(
      migrated.seasons,
      migrated.activeSeasonId,
      "2027-2028",
      1711976401000,
    );

    const reopened = reopenSeasonAsActive(
      rolled.seasons,
      rolled.activeSeasonId,
      migrated.activeSeasonId,
      1711976402000,
    );

    expect(reopened.activeSeasonId).toBe(migrated.activeSeasonId);
    expect(reopened.seasons[migrated.activeSeasonId].status).toBe("active");
    expect(reopened.seasons[migrated.activeSeasonId].closedAt).toBeUndefined();
    expect(reopened.seasons[rolled.activeSeasonId].status).toBe("closed");
    expect(reopened.seasons[rolled.activeSeasonId].closedAt).toBe(1711976402000);
  });

  it("renames a season without changing its status or matches", () => {
    const migrated = migrateLegacyDataToSeasons(
      [createMatchSummary()],
      { m1: createFullMatch() },
      1711976400000,
    );
    const seasonId = migrated.activeSeasonId;
    const renamed = renameSeason(migrated.seasons, seasonId, "Playoffs 2026");

    expect(renamed[seasonId].name).toBe("Playoffs 2026");
    expect(renamed[seasonId].status).toBe("active");
    expect(renamed[seasonId].matches).toHaveLength(1);
  });
});
