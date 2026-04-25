import { useEffect, useRef, type MouseEvent } from 'react';
import { Match } from '@/types/match';

interface ScoreboardProps {
  match: Match;
  myTeamScore: number;
  opponentScore: number;
  onOpponentLongPress?: () => void;
}

export function Scoreboard({
  match,
  myTeamScore,
  opponentScore,
  onOpponentLongPress,
}: ScoreboardProps) {
  const leftTeamName = match.isHome ? match.myTeamName : match.opponentName;
  const rightTeamName = match.isHome ? match.opponentName : match.myTeamName;

  const leftLabel = match.isHome ? 'Home' : 'Home';
  const rightLabel = match.isHome ? 'Away' : 'Away';

  const leftScore = match.isHome ? myTeamScore : opponentScore;
  const rightScore = match.isHome ? opponentScore : myTeamScore;

  const isMyTeamLeft = match.isHome;
  const leftIsOpponent = !match.isHome;
  const rightIsOpponent = match.isHome;
  const leftScoreClass = isMyTeamLeft ? 'text-primary' : 'text-accent';
  const rightScoreClass = isMyTeamLeft ? 'text-accent' : 'text-primary';
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  const startLongPress = () => {
    if (!onOpponentLongPress) return;
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onOpponentLongPress();
    }, 500);
  };

  const cancelLongPress = () => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const handleNameClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!longPressTriggeredRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    longPressTriggeredRef.current = false;
  };

  return (
    <div className="scoreboard-gradient rounded-2xl p-6 border border-border/50 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        {/* My Team */}
        <div className="min-w-0 flex-1 basis-0 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{leftLabel}</p>
          {leftIsOpponent ? (
            <button
              type="button"
              title={`${leftTeamName} (long press to edit)`}
              className="block w-full text-base sm:text-lg font-bold text-foreground truncate px-1 select-none"
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={handleNameClick}
            >
              {leftTeamName}
            </button>
          ) : (
            <p
              className="text-base sm:text-lg font-bold text-foreground truncate px-1"
              title={leftTeamName}
            >
              {leftTeamName}
            </p>
          )}
        </div>

        {/* Score */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3 px-1 sm:px-3">
          <span
            className={`text-4xl sm:text-5xl font-black ${leftScoreClass} tabular-nums animate-goal`}
          >
            {leftScore}
          </span>
          <span className="text-xl sm:text-2xl font-bold text-muted-foreground">-</span>
          <span className={`text-4xl sm:text-5xl font-black ${rightScoreClass} tabular-nums`}>
            {rightScore}
          </span>
        </div>

        {/* Opponent */}
        <div className="min-w-0 flex-1 basis-0 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {rightLabel}
          </p>
          {rightIsOpponent ? (
            <button
              type="button"
              title={`${rightTeamName} (long press to edit)`}
              className="block w-full text-base sm:text-lg font-bold text-foreground truncate px-1 select-none"
              onPointerDown={startLongPress}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={handleNameClick}
            >
              {rightTeamName}
            </button>
          ) : (
            <p
              className="text-base sm:text-lg font-bold text-foreground truncate px-1"
              title={rightTeamName}
            >
              {rightTeamName}
            </p>
          )}
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
