import type { SeasonStats } from "@/lib/seasons";

interface SeasonStatsCardProps {
  stats: SeasonStats;
}

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function SeasonStatsCard({ stats }: SeasonStatsCardProps) {
  const totalGoals = stats.goalsFor + stats.goalsAgainst;
  const goalsForWidth = totalGoals === 0 ? 50 : (stats.goalsFor / totalGoals) * 100;
  const goalDifference = stats.goalsFor - stats.goalsAgainst;
  const differenceColor =
    goalDifference > 0
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : goalDifference < 0
        ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
        : "bg-secondary text-muted-foreground";

  const record = [
    {
      label: "W",
      value: stats.wins,
      color: "text-emerald-700 dark:text-emerald-400",
      background: "bg-emerald-500/10",
    },
    {
      label: "D",
      value: stats.draws,
      color: "text-amber-700 dark:text-amber-400",
      background: "bg-amber-500/10",
    },
    {
      label: "L",
      value: stats.losses,
      color: "text-rose-700 dark:text-rose-400",
      background: "bg-rose-500/10",
    },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm lg:grid-cols-4">
      <div className="p-3 sm:p-4 lg:border-r lg:border-border/40">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          SEASON{" "}
          <span className="ml-1 font-normal normal-case tracking-normal">
            · {pluralize(stats.matches, "match")}
          </span>
        </p>
        <div
          className="flex gap-1.5"
          aria-label={`${pluralize(stats.wins, "win")}, ${pluralize(stats.draws, "draw")}, ${pluralize(stats.losses, "loss", "losses")}`}
        >
          {record.map((result) => (
            <div
              key={result.label}
              className={`flex h-9 min-w-10 flex-col items-center justify-center rounded-lg ${result.background} ${result.color}`}
            >
              <span className="text-sm font-bold leading-none">{result.value}</span>
              <span className="mt-0.5 text-[8px] font-semibold leading-none">{result.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-l border-border/40 p-3 sm:p-4 lg:border-l-0 lg:border-r">
        <div className="mb-2 flex items-center gap-2">
          <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            Goal Balance
          </p>
          <div
            className="flex h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-rose-500/70"
            role="img"
            aria-label={`${pluralize(stats.goalsFor, "goal")} scored and ${pluralize(stats.goalsAgainst, "goal")} against`}
          >
            <div className="bg-emerald-500" style={{ width: `${goalsForWidth}%` }} />
          </div>
        </div>
        <div
          className="flex items-baseline gap-1 whitespace-nowrap text-lg font-bold leading-none"
          aria-label={`${pluralize(stats.goalsFor, "goal")} scored, ${pluralize(stats.goalsAgainst, "goal")} against, difference ${goalDifference > 0 ? "plus " : ""}${goalDifference}`}
        >
          <span className="text-emerald-600 dark:text-emerald-400">{stats.goalsFor}</span>
          <span className="text-muted-foreground">-</span>
          <span className="text-rose-600 dark:text-rose-400">{stats.goalsAgainst}</span>
          <span
            className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${differenceColor}`}
          >
            <span>
              {goalDifference > 0 ? "+" : ""}
              {goalDifference}
            </span>
            <span>{goalDifference === 1 || goalDifference === -1 ? "goal" : "goals"}</span>
          </span>
        </div>
      </div>

      <div className="border-t border-border/40 p-3 sm:p-4 lg:border-l-0 lg:border-r lg:border-t-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Top scorer
        </p>
        <p className="truncate text-sm font-semibold">{stats.topScorer ?? "No goals yet"}</p>
        {stats.topScorer && (
          <p className="text-[10px] text-muted-foreground">
            {pluralize(stats.topScorerGoals, "goal")}
          </p>
        )}
      </div>

      <div className="border-l border-t border-border/40 p-3 sm:p-4 lg:border-l-0 lg:border-t-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Assist leader
        </p>
        <p className="truncate text-sm font-semibold">{stats.topAssister ?? "No assists yet"}</p>
        {stats.topAssister && (
          <p className="text-[10px] text-muted-foreground">
            {pluralize(stats.topAssists, "assist")}
          </p>
        )}
      </div>
    </div>
  );
}
