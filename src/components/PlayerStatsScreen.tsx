import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Handshake,
  History,
  Settings,
  Trophy,
} from "lucide-react";
import type { SeasonPlayerStats } from "@/lib/seasons";
import type { Season } from "@/types/match";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlayerStatsScreenProps {
  seasons: Pick<Season, "id" | "name" | "status">[];
  selectedSeasonId: string | null;
  stats: SeasonPlayerStats[];
  hasActiveMatch: boolean;
  onSelectSeason: (seasonId: string) => void;
  onGoHome: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

const columns: { key: keyof SeasonPlayerStats; label: string; width: string }[] = [
  { key: "name", label: "Player", width: "36%" },
  { key: "goals", label: "Goals", width: "16%" },
  { key: "assists", label: "Assists", width: "16%" },
  { key: "yellowCards", label: "Yellow", width: "16%" },
  { key: "redCards", label: "Red", width: "16%" },
];

export function PlayerStatsScreen({
  seasons,
  selectedSeasonId,
  stats,
  hasActiveMatch,
  onSelectSeason,
  onGoHome,
  onOpenHistory,
  onOpenSettings,
}: PlayerStatsScreenProps) {
  const [sort, setSort] = useState<{ key: keyof SeasonPlayerStats; ascending: boolean }>({
    key: "goals",
    ascending: false,
  });
  const sortedPlayers = [...stats].sort((a, b) => {
    const difference =
      sort.key === "name"
        ? a.name.localeCompare(b.name)
        : (a[sort.key] as number) - (b[sort.key] as number);
    return (sort.ascending ? difference : -difference) || a.name.localeCompare(b.name);
  });
  const rankings = [
    {
      key: "goals" as const,
      title: "Scorers",
      Icon: Trophy,
      color: "text-amber-700 dark:text-amber-400",
      empty: "No goals recorded",
    },
    {
      key: "assists" as const,
      title: "Assists",
      Icon: Handshake,
      color: "text-emerald-700 dark:text-emerald-400",
      empty: "No assists recorded",
    },
  ];
  const backLabel = hasActiveMatch ? "Back to match" : "Home";

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden safe-top"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/30 p-4">
        <h1 className="min-w-0 text-xl font-bold text-foreground">Player Stats</h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Settings"
            title="Settings"
            onClick={onOpenSettings}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="History"
            title="Match history"
            onClick={onOpenHistory}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label={backLabel}
            onClick={onGoHome}
            className="h-10 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {hasActiveMatch ? "Back to Match" : "Home"}
          </button>
        </div>
      </header>

      {seasons.length > 0 && (
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="mx-auto max-w-5xl">
            <label
              htmlFor="player-stats-season-select"
              className="mb-1.5 block text-xs text-muted-foreground"
            >
              Season
            </label>
            <select
              id="player-stats-season-select"
              value={selectedSeasonId ?? ""}
              onChange={(event) => onSelectSeason(event.target.value)}
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.status === "active" ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {rankings.map(({ key, title, Icon, color, empty }) => {
              const ranked = stats
                .filter((player) => player[key] > 0)
                .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
              let rank = 0;
              return (
                <section
                  key={key}
                  aria-label={title}
                  className="min-w-0 rounded-lg border border-border/50 bg-card p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    <h2 className="flex-1 text-base font-semibold">{title}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {ranked.length} {ranked.length === 1 ? "player" : "players"}
                    </span>
                  </div>
                  {ranked.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">{empty}</p>
                  ) : (
                    <ol className="divide-y divide-border/40">
                      {ranked.map((player, index) => {
                        if (index === 0 || ranked[index - 1][key] !== player[key]) rank = index + 1;
                        return (
                          <li
                            key={player.name}
                            className="grid grid-cols-[1.5rem_minmax(0,1fr)_3rem] items-center gap-2 py-2.5 text-sm"
                          >
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {rank}
                            </span>
                            <span className="font-medium [overflow-wrap:anywhere]">
                              {player.name}
                            </span>
                            <span className={`text-right font-bold tabular-nums ${color}`}>
                              {player[key]}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              );
            })}
          </div>

          <section aria-label="Player statistics" className="min-w-0">
            <h2 className="mb-2 text-base font-semibold">Player Statistics</h2>
            <Table aria-label="Season player stats" className="min-w-[480px] table-fixed">
              <colgroup>
                {columns.map(({ key, width }) => (
                  <col key={key} style={{ width }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow>
                  {columns.map(({ key, label }) => {
                    const active = sort.key === key;
                    const SortIcon = active ? (sort.ascending ? ArrowUp : ArrowDown) : ArrowUpDown;
                    return (
                      <TableHead
                        key={key}
                        scope="col"
                        aria-sort={active ? (sort.ascending ? "ascending" : "descending") : "none"}
                        className={`px-2 ${key === "name" ? "sticky left-0 z-10 bg-background" : "text-center"}`}
                      >
                        <button
                          type="button"
                          aria-label={`Sort by ${label}`}
                          onClick={() =>
                            setSort({ key, ascending: active ? !sort.ascending : key === "name" })
                          }
                          className={`flex min-h-11 w-full items-center gap-1 py-2 text-xs transition-colors hover:text-foreground ${key === "name" ? "justify-start" : "justify-center"} ${active ? "text-foreground" : ""}`}
                        >
                          <span>{label}</span>
                          <SortIcon className="h-3 w-3 shrink-0" />
                        </button>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((player) => (
                  <TableRow key={player.name}>
                    <th
                      scope="row"
                      className="sticky left-0 bg-background px-2 py-3 text-left text-sm font-medium [overflow-wrap:anywhere]"
                    >
                      {player.name}
                    </th>
                    {columns.slice(1).map(({ key }) => (
                      <TableCell
                        key={key}
                        className={`px-2 py-3 text-center tabular-nums ${player[key] === 0 ? "text-muted-foreground" : ""}`}
                      >
                        {player[key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {stats.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No player stats recorded for this season.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
