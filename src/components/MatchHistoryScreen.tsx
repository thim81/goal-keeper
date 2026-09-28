import { useEffect, useRef } from "react";
import { CalendarRange, RotateCcw, Settings } from "lucide-react";
import { MatchHistory } from "@/components/MatchHistory";
import { SeasonDialogs } from "@/components/SeasonDialogs";
import { SeasonStatsCard } from "@/components/SeasonStatsCard";
import type { SeasonStats } from "@/lib/seasons";
import type { MatchSummary, SeasonStatus } from "@/types/match";

interface SeasonOption {
  id: string;
  name: string;
  status: SeasonStatus;
}

interface MatchHistoryScreenProps {
  seasons: SeasonOption[];
  selectedSeasonId: string | null;
  selectedSeason?: SeasonOption;
  matches: MatchSummary[];
  stats: SeasonStats | null;
  activeSeasonStats: SeasonStats | null;
  canEdit: boolean;
  canCloseSeason: boolean;
  canReopenSeason: boolean;
  hasActiveMatch: boolean;
  onSelectSeason: (seasonId: string) => void;
  onSelectMatch: (matchId: string) => void;
  onDeleteMatch?: (matchId: string) => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
  onCloseSeason: (name: string) => boolean;
  onReopenSeason: (seasonId: string) => boolean;
  onRenameSeason: (seasonId: string, name: string) => boolean;
}

export function MatchHistoryScreen({
  seasons,
  selectedSeasonId,
  selectedSeason,
  matches,
  stats,
  activeSeasonStats,
  canEdit,
  canCloseSeason,
  canReopenSeason,
  hasActiveMatch,
  onSelectSeason,
  onSelectMatch,
  onDeleteMatch,
  onOpenSettings,
  onGoHome,
  onCloseSeason,
  onReopenSeason,
  onRenameSeason,
}: MatchHistoryScreenProps) {
  const renameTimer = useRef<number | null>(null);
  const renameTriggered = useRef(false);
  const seasonLabel = selectedSeason
    ? `${selectedSeason.name}${selectedSeason.status === "active" ? " (Active)" : ""}`
    : "";

  const startRenameTimer = (openRenameSeason: () => void) => {
    if (!selectedSeason) return;
    renameTriggered.current = false;
    if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
    renameTimer.current = window.setTimeout(() => {
      renameTriggered.current = true;
      openRenameSeason();
    }, 500);
  };

  const clearRenameTimer = () => {
    if (renameTimer.current === null) return;
    window.clearTimeout(renameTimer.current);
    renameTimer.current = null;
  };

  const handleSeasonLabelClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!renameTriggered.current) return;
    event.preventDefault();
    event.stopPropagation();
    renameTriggered.current = false;
  };

  useEffect(() => clearRenameTimer, []);

  return (
    <div className="min-h-screen flex flex-col safe-top overflow-hidden">
      <SeasonDialogs
        canEdit={canEdit}
        canCloseSeason={canCloseSeason}
        canReopenSeason={canReopenSeason}
        activeSeasonStats={activeSeasonStats}
        selectedSeason={selectedSeason}
        onCloseSeason={onCloseSeason}
        onReopenSeason={onReopenSeason}
        onRenameSeason={onRenameSeason}
      >
        {({ openCloseSeason, openReopenSeason, openRenameSeason }) => (
          <div className="flex items-center justify-between p-4 border-b border-border/30">
            <div>
              <h1 className="text-xl font-bold text-foreground">Match History</h1>
              {seasonLabel && (
                <button
                  type="button"
                  className="mt-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={canEdit ? "Long press to rename season" : undefined}
                  onPointerDown={canEdit ? () => startRenameTimer(openRenameSeason) : undefined}
                  onPointerUp={canEdit ? clearRenameTimer : undefined}
                  onPointerLeave={canEdit ? clearRenameTimer : undefined}
                  onPointerCancel={canEdit ? clearRenameTimer : undefined}
                  onContextMenu={canEdit ? (event) => event.preventDefault() : undefined}
                  onClick={canEdit ? handleSeasonLabelClick : undefined}
                >
                  {seasonLabel}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && selectedSeason?.status === "closed" && (
                <button
                  onClick={() => openReopenSeason(selectedSeason.id)}
                  disabled={!canReopenSeason}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reopen this season"
                >
                  <RotateCcw className="w-5 h-5 text-foreground" />
                </button>
              )}
              {canEdit && (
                <button
                  onClick={openCloseSeason}
                  className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                  title="Close season and start new"
                >
                  <CalendarRange className="w-5 h-5 text-foreground" />
                </button>
              )}
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Settings className="w-5 h-5 text-foreground" />
              </button>
              <button
                onClick={onGoHome}
                className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                {hasActiveMatch ? "Back to Match" : "Home"}
              </button>
            </div>
          </div>
        )}
      </SeasonDialogs>

      <div className="flex-1 p-4 flex flex-col overflow-hidden">
        {seasons.length > 0 && (
          <div className="mb-3">
            <label
              htmlFor="history-season-select"
              className="text-xs text-muted-foreground mb-1.5 block"
            >
              Season
            </label>
            <select
              id="history-season-select"
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
        )}
        {stats && <SeasonStatsCard stats={stats} />}
        <h2 className="mb-2 text-sm font-semibold text-foreground">Past Matches</h2>
        <MatchHistory
          matches={matches}
          onSelectMatch={onSelectMatch}
          onDeleteMatch={onDeleteMatch}
        />
      </div>
    </div>
  );
}
