import { ChevronRight, Trophy, Trash2 } from 'lucide-react';
import { MatchSummary } from '@/types/match';

interface MatchHistoryProps {
  matches: MatchSummary[];
  onSelectMatch: (matchId: string) => void;
  onDeleteMatch: (matchId: string) => void;
}

export function MatchHistory({ matches, onSelectMatch, onDeleteMatch }: MatchHistoryProps) {
  if (matches.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium">No matches yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Start your first match to track goals!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto overscroll-none"
      style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
    >
      <div className="space-y-3">
        {matches.map((match, index) => {
          const isWin = match.myTeamScore > match.opponentScore;
          const isDraw = match.myTeamScore === match.opponentScore;
          const resultColor = isWin ? 'text-primary' : isDraw ? 'text-goal' : 'text-accent';
          const resultBg = isWin ? 'bg-primary/10' : isDraw ? 'bg-goal/10' : 'bg-accent/10';

          return (
            <div
              key={match.id}
              className="animate-slide-up card-gradient rounded-xl border border-border/30 overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <button
                onClick={() => onSelectMatch(match.id)}
                className="w-full p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded ${resultBg} ${resultColor}`}
                      >
                        {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                      </span>
                      <span className="text-xs text-muted-foreground">{match.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{match.myTeamName}</span>
                      <span className="text-2xl font-black text-primary">{match.myTeamScore}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-2xl font-black text-accent">{match.opponentScore}</span>
                      <span className="font-semibold text-foreground">{match.opponentName}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>

              {/* Delete button */}
              <div className="border-t border-border/30 px-4 py-2 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteMatch(match.id);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors p-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
