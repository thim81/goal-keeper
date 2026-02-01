import { Match } from '@/types/match';

interface ScoreboardProps {
  match: Match;
  myTeamScore: number;
  opponentScore: number;
}

export function Scoreboard({ match, myTeamScore, opponentScore }: ScoreboardProps) {
  const leftTeamName = match.isHome ? match.myTeamName : match.opponentName;
  const rightTeamName = match.isHome ? match.opponentName : match.myTeamName;

  const leftLabel = match.isHome ? 'Home' : 'Home';
  const rightLabel = match.isHome ? 'Away' : 'Away';

  const leftScore = match.isHome ? myTeamScore : opponentScore;
  const rightScore = match.isHome ? opponentScore : myTeamScore;

  const isMyTeamLeft = match.isHome;
  const leftScoreClass = isMyTeamLeft ? 'text-primary' : 'text-accent';
  const rightScoreClass = isMyTeamLeft ? 'text-accent' : 'text-primary';

  return (
    <div className="scoreboard-gradient rounded-2xl p-6 border border-border/50 shadow-lg">
      <div className="flex items-center justify-between">
        {/* My Team */}
        <div className="flex-1 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{leftLabel}</p>
          <p className="text-lg font-bold text-foreground truncate px-2">{leftTeamName}</p>
        </div>

        {/* Score */}
        <div className="flex items-center gap-3 px-4">
          <span className={`text-5xl font-black ${leftScoreClass} tabular-nums animate-goal`}>
            {leftScore}
          </span>
          <span className="text-2xl font-bold text-muted-foreground">-</span>
          <span className={`text-5xl font-black ${rightScoreClass} tabular-nums`}>
            {rightScore}
          </span>
        </div>

        {/* Opponent */}
        <div className="flex-1 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {rightLabel}
          </p>
          <p className="text-lg font-bold text-foreground truncate px-2">{rightTeamName}</p>
        </div>
      </div>

      {/* Live indicator */}
      {/*<div className="flex items-center justify-center mt-4 gap-2">*/}
      {/*  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>*/}
      {/*  <span className="text-xs uppercase tracking-widest text-primary font-semibold">Live</span>*/}
      {/*</div>*/}
    </div>
  );
}
