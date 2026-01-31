import { Undo2, Flag, Plus, ClipboardList } from 'lucide-react';

interface MatchActionsProps {
  onAddMyGoal: () => void;
  onAddOpponentGoal: () => void;
  onAddEvent: () => void;
  onUndo: () => void;
  onEndMatch: () => void;
  canUndo: boolean;
}

export function MatchActions({
  onAddMyGoal,
  onAddOpponentGoal,
  onAddEvent,
  onUndo,
  onEndMatch,
  canUndo,
}: MatchActionsProps) {
  return (
    <div className="bg-card/80 backdrop-blur-lg border-t border-border/50 p-4 safe-bottom">
      {/* Main goal buttons */}
      <div className="grid grid-cols-2 gap-3 mb-3">
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
      </div>

      {/* Secondary actions */}
      <div className="flex gap-3">
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
    </div>
  );
}
