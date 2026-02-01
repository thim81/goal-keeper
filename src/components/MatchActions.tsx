import { Undo2, Flag, Plus, ClipboardList, Play, Pause, Square, StepForward } from 'lucide-react';

interface MatchActionsProps {
  onAddMyGoal: () => void;
  onAddOpponentGoal: () => void;
  onAddEvent: () => void;
  onUndo: () => void;
  onEndMatch: () => void;
  onStartPeriod: () => void;
  onEndPeriod: () => void;
  onToggleTimer: () => void;
  isRunning: boolean;
  canUndo: boolean;
  currentPeriod: number;
  isPeriodEnded: boolean;
  isHome: boolean;
  showSecondaryActions?: boolean;
  secondaryClassName?: string;
}

export function MatchActions({
  onAddMyGoal,
  onAddOpponentGoal,
  onAddEvent,
  onUndo,
  onEndMatch,
  onStartPeriod,
  onEndPeriod,
  onToggleTimer,
  isRunning,
  canUndo,
  currentPeriod,
  isPeriodEnded,
  isHome,
  showSecondaryActions = true,
  secondaryClassName,
}: MatchActionsProps) {
  return (
    <div>

      {/* Main goal buttons */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {isHome ? (
          <>
            <button
              onClick={onAddMyGoal}
              className="flex items-center justify-center gap-2 py-5 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] btn-glow"
            >
              <Plus className="w-5 h-5" />
              We Scored!
            </button>
            <button
              onClick={onAddOpponentGoal}
              className="flex items-center justify-center gap-2 py-5 bg-accent text-accent-foreground font-bold text-lg rounded-xl hover:bg-accent/90 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              They Scored
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onAddOpponentGoal}
              className="flex items-center justify-center gap-2 py-5 bg-accent text-accent-foreground font-bold text-lg rounded-xl hover:bg-accent/90 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              They Scored
            </button>
            <button
              onClick={onAddMyGoal}
              className="flex items-center justify-center gap-2 py-5 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] btn-glow"
            >
              <Plus className="w-5 h-5" />
              We Scored!
            </button>
          </>
        )}
      </div>

      {/* Timer Controls */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          onClick={onToggleTimer}
          disabled={!isRunning && isPeriodEnded}
          className="flex items-center justify-center gap-1 py-3 px-1 bg-secondary text-secondary-foreground font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/80"
        >
          {isRunning ? (
            <>
              <Pause className="w-5 h-5 text-goal" />
              <span className="text-xs">Pause Time</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 text-goal" />
              <span className="text-xs">Resume Time</span>
            </>
          )}
        </button>
        {isPeriodEnded && (
          <button
            onClick={onStartPeriod}
            className="flex items-center justify-center gap-1 py-3 px-1 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <StepForward className="w-5 h-5 text-primary" />
            <span className="text-xs">Start Period {currentPeriod + 1}</span>
          </button>
        )}
        {!isPeriodEnded && (
          <button
            onClick={onEndPeriod}
            className="flex items-center justify-center gap-1 py-3 px-1 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <Square className="w-5 h-5 text-accent" />
            <span className="text-xs">End Period {currentPeriod}</span>
          </button>
        )}
      </div>

      {/* Secondary actions */}
      {showSecondaryActions && (
        <div className={`flex gap-3 ${secondaryClassName ?? ''}`}>
          <button
            onClick={onAddEvent}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Event
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground font-medium rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Undo
          </button>
          <button
            onClick={onEndMatch}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <Flag className="w-4 h-4" />
            End
          </button>
        </div>
      )}
    </div>
  );
}
