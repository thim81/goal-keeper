import { Match } from '@/types/match';

interface ScoreboardProps {
  match: Match;
  myTeamScore: number;
  opponentScore: number;
}

export function Scoreboard({ match, myTeamScore, opponentScore }: ScoreboardProps) {
  return (
    <div className="scoreboard-gradient rounded-2xl p-6 border border-border/50 shadow-lg">
      <div className="flex items-center justify-between">
        {/* My Team */}
        <div className="flex-1 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {match.isHome ? 'Home' : 'Away'}
          </p>
          <p className="text-lg font-bold text-foreground truncate px-2">{match.myTeamName}</p>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 px-4">
          <span className="text-5xl font-black text-primary tabular-nums animate-goal">
            {myTeamScore}
          </span>
          <span className="text-2xl font-bold text-muted-foreground">-</span>
          <span className="text-5xl font-black text-accent tabular-nums">{opponentScore}</span>
        </div>

        {/* Opponent */}
        <div className="flex-1 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {match.isHome ? 'Away' : 'Home'}
          </p>
          <p className="text-lg font-bold text-foreground truncate px-2">{match.opponentName}</p>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center mt-4 gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        <span className="text-xs uppercase tracking-widest text-primary font-semibold">Live</span>
      </div>
    </div>
  );
}
