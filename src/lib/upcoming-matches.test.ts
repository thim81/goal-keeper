import { describe, expect, it } from "vitest";
import {
  getUpcomingMatchCountdown,
  UPCOMING_MATCH_COUNTDOWN_GRACE_MS,
  UPCOMING_MATCH_COUNTDOWN_WINDOW_MS,
  type UpcomingMatch,
} from "./upcoming-matches";

const fixture = (start: number, id = "next"): UpcomingMatch => ({
  id,
  start: new Date(start).toISOString(),
  homeTeam: "Home Team",
  awayTeam: "Away Team",
  opponentName: "Away Team",
  isHome: true,
});

describe("upcoming match countdown", () => {
  it("starts at the one-hour boundary and chooses the earliest fixture", () => {
    const now = Date.now();
    const later = fixture(now + UPCOMING_MATCH_COUNTDOWN_WINDOW_MS, "later");
    const next = fixture(now + 30 * 60 * 1000, "next");

    expect(getUpcomingMatchCountdown([later], now)).toEqual({
      match: later,
      secondsRemaining: 3600,
    });
    expect(getUpcomingMatchCountdown([later, next], now)?.match).toEqual(next);
    expect(getUpcomingMatchCountdown([fixture(now + UPCOMING_MATCH_COUNTDOWN_WINDOW_MS + 1)], now))
      .toBeNull();
  });

  it("keeps the card for fifteen minutes after kickoff, then hides", () => {
    const now = Date.now();
    const startsSoon = fixture(now + 2000);
    expect(getUpcomingMatchCountdown([startsSoon], now)?.secondsRemaining).toBe(2);
    expect(getUpcomingMatchCountdown([startsSoon], now + 1000)?.secondsRemaining).toBe(1);

    const started = fixture(now - 1000);
    expect(getUpcomingMatchCountdown([started], now)).toEqual({
      match: started,
      secondsRemaining: 0,
    });
    expect(getUpcomingMatchCountdown([fixture(now - UPCOMING_MATCH_COUNTDOWN_GRACE_MS)], now))
      .not.toBeNull();
    expect(getUpcomingMatchCountdown([fixture(now - UPCOMING_MATCH_COUNTDOWN_GRACE_MS - 1)], now))
      .toBeNull();
  });
});
