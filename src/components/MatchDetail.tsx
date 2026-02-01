import { ArrowLeft } from 'lucide-react';
import { Match } from '@/types/match';
import { GoalTimeline } from './GoalTimeline';

interface MatchDetailProps {
  match: Match;
  onBack: () => void;
}

export function MatchDetail({ match, onBack }: MatchDetailProps) {
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

  return (
    <div className="min-h-screen flex flex-col safe-top overflow-hidden">
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
        <div className="flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {match.isHome ? 'Home' : 'Away'}
            </p>
            <p className="text-lg font-bold text-foreground">{match.myTeamName}</p>
          </div>
          <div className="flex items-center gap-3 px-4">
            <span className="text-5xl font-black text-primary">{myTeamScore}</span>
            <span className="text-2xl font-bold text-muted-foreground">-</span>
            <span className="text-5xl font-black text-accent">{opponentScore}</span>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {match.isHome ? 'Away' : 'Home'}
            </p>
            <p className="text-lg font-bold text-foreground">{match.opponentName}</p>
          </div>
        </div>
        <div className="text-center mt-4">
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${
              isWin
                ? 'bg-primary/20 text-primary'
                : isDraw
                  ? 'bg-goal/20 text-goal'
                  : 'bg-accent/20 text-accent'
            }`}
          >
            {isWin ? 'Victory!' : isDraw ? 'Draw' : 'Defeat'}
          </span>
        </div>
      </div>

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
    </div>
  );
}
