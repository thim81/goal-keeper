import type { MatchSummary } from "@/types/match";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getRecentMatchWithinDays(
  matches: MatchSummary[],
  now = Date.now(),
  days = 7,
): MatchSummary | null {
  const latestMatch = matches.reduce<MatchSummary | null>(
    (latest, match) => (!latest || match.endedAt > latest.endedAt ? match : latest),
    null,
  );

  if (!latestMatch) return null;

  const age = now - latestMatch.endedAt;
  return age >= 0 && age <= days * DAY_IN_MILLISECONDS ? latestMatch : null;
}
