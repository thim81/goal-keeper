type RankedOpponent = {
  name: string;
  rank: number;
  recentIndex: number;
};

function matchRank(name: string, query: string): number | null {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  return null;
}

export function getOpponentSuggestions(opponents: string[], query: string, limit = 8): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 1) return [];

  const uniqueOpponents = new Map<string, RankedOpponent>();
  opponents.forEach((opponent, recentIndex) => {
    const name = opponent.trim();
    const normalizedName = name.toLowerCase();
    if (!name || !normalizedName.includes(normalizedQuery)) return;

    const rank = matchRank(normalizedName, normalizedQuery);
    if (rank === null || uniqueOpponents.has(normalizedName)) return;
    uniqueOpponents.set(normalizedName, { name, rank, recentIndex });
  });

  return [...uniqueOpponents.values()]
    .sort((a, b) => a.rank - b.rank || a.recentIndex - b.recentIndex)
    .slice(0, limit)
    .map(({ name }) => name);
}
