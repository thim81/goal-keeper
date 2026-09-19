import { ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import type { MatchSummary } from "@/types/match";

type MatchResultCardProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick"
> & {
  match: MatchSummary;
  onSelect: () => void;
  showChevron?: boolean;
};

export function MatchResultCard({
  match,
  onSelect,
  showChevron = true,
  className = "",
  ...buttonProps
}: MatchResultCardProps) {
  const isWin = match.myTeamScore > match.opponentScore;
  const isDraw = match.myTeamScore === match.opponentScore;
  const resultColor = isWin ? "text-primary" : isDraw ? "text-goal" : "text-accent";
  const resultBg = isWin ? "bg-primary/10" : isDraw ? "bg-goal/10" : "bg-accent/10";
  const homeTeamName = match.isHome ? match.myTeamName : match.opponentName;
  const awayTeamName = match.isHome ? match.opponentName : match.myTeamName;
  const homeScore = match.isHome ? match.myTeamScore : match.opponentScore;
  const awayScore = match.isHome ? match.opponentScore : match.myTeamScore;

  return (
    <button
      {...buttonProps}
      onClick={onSelect}
      className={`w-full p-4 text-left hover:bg-secondary/30 transition-colors touch-pan-y ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-xs font-bold px-2 py-1 rounded ${resultBg} ${resultColor}`}>
              {isWin ? "WIN" : isDraw ? "DRAW" : "LOSS"}
            </span>
            <span className="text-xs text-muted-foreground">{match.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{homeTeamName}</span>
            <span className="text-2xl font-black text-primary">{homeScore}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-2xl font-black text-accent">{awayScore}</span>
            <span className="font-semibold text-foreground">{awayTeamName}</span>
          </div>
        </div>
        {showChevron && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
      </div>
    </button>
  );
}
