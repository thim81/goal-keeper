import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Match } from '@/types/match';
import { GoalTimeline } from './GoalTimeline';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayerAutocomplete } from './PlayerAutocomplete';

interface MatchDetailProps {
  match: Match;
  onBack: () => void;
  onRenameOpponent?: (name: string) => void;
  opponentSuggestions?: string[];
}

export function MatchDetail({
  match,
  onBack,
  onRenameOpponent,
  opponentSuggestions = [],
}: MatchDetailProps) {
  const [showRenameOpponent, setShowRenameOpponent] = useState(false);
  const [opponentDraft, setOpponentDraft] = useState(match.opponentName);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    setOpponentDraft(match.opponentName);
  }, [match.opponentName]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  const myTeamScore = match.goals.filter(
    (g) =>
      (g.team === 'my-team' && g.type !== 'own-goal') ||
      (g.team === 'opponent' && g.type === 'own-goal'),
  ).length;

  const opponentScore = match.goals.filter(
    (g) =>
      (g.team === 'opponent' && g.type !== 'own-goal') ||
      (g.team === 'my-team' && g.type === 'own-goal'),
  ).length;

  const isWin = myTeamScore > opponentScore;
  const isDraw = myTeamScore === opponentScore;

  // Calculate scorer and assist statistics
  const myTeamGoals = match.goals.filter((g) => g.team === 'my-team' && g.type !== 'own-goal');

  const scorerStats = myTeamGoals.reduce(
    (acc, goal) => {
      if (goal.scorer) {
        acc[goal.scorer] = (acc[goal.scorer] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const assistStats = myTeamGoals.reduce(
    (acc, goal) => {
      if (goal.assist) {
        acc[goal.assist] = (acc[goal.assist] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const topScorers = Object.entries(scorerStats).sort((a, b) => b[1] - a[1]);
  const topAssisters = Object.entries(assistStats).sort((a, b) => b[1] - a[1]);

  const cardTotals = match.events.reduce(
    (acc, event) => {
      if (!event.team) return acc;
      if (event.type === 'yellow-card') {
        acc[event.team].yellow += 1;
      } else if (event.type === 'red-card') {
        acc[event.team].red += 1;
      }
      return acc;
    },
    {
      'my-team': { yellow: 0, red: 0 },
      opponent: { yellow: 0, red: 0 },
    } as Record<'my-team' | 'opponent', { yellow: number; red: number }>,
  );
  const myTeamHasCards = cardTotals['my-team'].yellow > 0 || cardTotals['my-team'].red > 0;
  const opponentHasCards = cardTotals.opponent.yellow > 0 || cardTotals.opponent.red > 0;
  const homeTeamName = match.isHome ? match.myTeamName : match.opponentName;
  const awayTeamName = match.isHome ? match.opponentName : match.myTeamName;
  const homeScore = match.isHome ? myTeamScore : opponentScore;
  const awayScore = match.isHome ? opponentScore : myTeamScore;
  const homeScoreColor = match.isHome ? 'text-primary' : 'text-accent';
  const awayScoreColor = match.isHome ? 'text-accent' : 'text-primary';
  const homeIsOpponent = !match.isHome;
  const awayIsOpponent = match.isHome;

  const startLongPress = () => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setOpponentDraft(match.opponentName);
      setShowRenameOpponent(true);
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

  const handleSaveOpponentName = () => {
    const trimmed = opponentDraft.trim();
    if (!trimmed) return;
    onRenameOpponent?.(trimmed);
    setShowRenameOpponent(false);
  };

  return (
    <div
      className="flex flex-col safe-top overflow-hidden"
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Match Details</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(match.startedAt).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Score Summary */}
      <div className="scoreboard-gradient p-6 mx-4 mt-4 rounded-2xl border border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 basis-0 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Home</p>
            {homeIsOpponent ? (
              <button
                type="button"
                title={`${homeTeamName} (long press to edit)`}
                className="block w-full text-base sm:text-lg font-bold text-foreground truncate px-1 select-none"
                onPointerDown={startLongPress}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={handleNameClick}
              >
                {homeTeamName}
              </button>
            ) : (
              <p
                className="text-base sm:text-lg font-bold text-foreground truncate px-1"
                title={homeTeamName}
              >
                {homeTeamName}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3 px-1 sm:px-3">
            <span className={`text-4xl sm:text-5xl font-black ${homeScoreColor}`}>{homeScore}</span>
            <span className="text-xl sm:text-2xl font-bold text-muted-foreground">-</span>
            <span className={`text-4xl sm:text-5xl font-black ${awayScoreColor}`}>{awayScore}</span>
          </div>
          <div className="min-w-0 flex-1 basis-0 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Away</p>
            {awayIsOpponent ? (
              <button
                type="button"
                title={`${awayTeamName} (long press to edit)`}
                className="block w-full text-base sm:text-lg font-bold text-foreground truncate px-1 select-none"
                onPointerDown={startLongPress}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={handleNameClick}
              >
                {awayTeamName}
              </button>
            ) : (
              <p
                className="text-base sm:text-lg font-bold text-foreground truncate px-1"
                title={awayTeamName}
              >
                {awayTeamName}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="justify-self-center min-h-8 inline-flex items-center gap-1">
            {myTeamHasCards && cardTotals['my-team'].yellow > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-600">
                <span className="inline-block h-5 w-4 rounded-[2px] border bg-yellow-400 border-yellow-500" />
                {cardTotals['my-team'].yellow}
              </span>
            )}
            {myTeamHasCards && cardTotals['my-team'].red > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">
                <span className="inline-block h-5 w-4 rounded-[2px] border bg-red-500 border-red-600" />
                {cardTotals['my-team'].red}
              </span>
            )}
          </div>
          <span
            className={`justify-self-center text-sm font-bold px-3 py-1 rounded-full ${
              isWin
                ? 'bg-primary/20 text-primary'
                : isDraw
                  ? 'bg-goal/20 text-goal'
                  : 'bg-accent/20 text-accent'
            }`}
          >
            {isWin ? 'Victory!' : isDraw ? 'Draw' : 'Defeat'}
          </span>
          <div className="justify-self-center min-h-8 inline-flex items-center gap-1">
            {opponentHasCards && cardTotals.opponent.yellow > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-600">
                <span className="inline-block h-5 w-4 rounded-[2px] border bg-yellow-400 border-yellow-500" />
                {cardTotals.opponent.yellow}
              </span>
            )}
            {opponentHasCards && cardTotals.opponent.red > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-500/15 text-red-600">
                <span className="inline-block h-5 w-4 rounded-[2px] border bg-red-500 border-red-600" />
                {cardTotals.opponent.red}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player Statistics */}
      {(topScorers.length > 0 || topAssisters.length > 0) && (
        <div className="mx-4 mt-4 p-4 bg-secondary/50 rounded-xl border border-border/30">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Player Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Scorers */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Top Scorers</h3>
              {topScorers.length > 0 ? (
                <div className="space-y-1.5">
                  {topScorers.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-foreground font-medium">{name}</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No scorers recorded</p>
              )}
            </div>

            {/* Assists */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Top Assists</h3>
              {topAssisters.length > 0 ? (
                <div className="space-y-1.5">
                  {topAssisters.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-sm text-foreground font-medium">{name}</span>
                      <span className="text-xs bg-goal/20 text-goal px-2 py-0.5 rounded-full font-bold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No assists recorded</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div
        className="flex-1 p-4 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px))` }}
      >
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Timeline
        </h2>
        <GoalTimeline
          goals={match.goals}
          events={match.events || []}
          myTeamName={match.myTeamName}
          opponentName={match.opponentName}
        />
      </div>

      <Dialog
        open={showRenameOpponent}
        onOpenChange={(open) => {
          setShowRenameOpponent(open);
          if (!open) setOpponentDraft(match.opponentName);
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Opponent Name</DialogTitle>
            <DialogDescription>Long-press the opponent team name to rename it.</DialogDescription>
          </DialogHeader>
          <PlayerAutocomplete
            value={opponentDraft}
            onChange={setOpponentDraft}
            players={opponentSuggestions}
            placeholder="Opponent name"
            autoFocus
            maxLength={60}
            onEnter={handleSaveOpponentName}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowRenameOpponent(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOpponentName} disabled={!opponentDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
