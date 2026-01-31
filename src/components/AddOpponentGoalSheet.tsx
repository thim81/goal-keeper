import { useState } from 'react';
import { X, Trophy, Target, AlertCircle, CircleDot } from 'lucide-react';
import { GoalType } from '@/types/match';

interface AddOpponentGoalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: (type: GoalType) => void;
  opponentName: string;
}

const goalTypes: { type: GoalType; label: string; icon: typeof Trophy }[] = [
  { type: 'normal', label: 'Normal', icon: Trophy },
  { type: 'head', label: 'Header', icon: CircleDot },
  { type: 'penalty', label: 'Penalty', icon: Target },
  { type: 'own-goal', label: 'Own Goal', icon: AlertCircle },
];

export function AddOpponentGoalSheet({
  isOpen,
  onClose,
  onAddGoal,
  opponentName,
}: AddOpponentGoalSheetProps) {
  const [goalType, setGoalType] = useState<GoalType>('normal');

  const handleSubmit = () => {
    onAddGoal(goalType);
    setGoalType('normal');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 safe-bottom animate-slide-up border-t border-border/50">
        {/* Handle */}
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">{opponentName} Goal</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Goal Type */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Goal Type</label>
          <div className="grid grid-cols-4 gap-2">
            {goalTypes.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setGoalType(type)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  goalType === type
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-secondary hover:border-accent/50'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${goalType === type ? 'text-accent' : 'text-muted-foreground'}`}
                />
                <span
                  className={`text-xs font-medium ${goalType === type ? 'text-accent' : 'text-muted-foreground'}`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            className="w-full py-4 bg-accent text-accent-foreground font-bold text-lg rounded-xl hover:bg-accent/90 transition-colors mt-2"
          >
            Add Goal
          </button>
        </div>
      </div>
    </div>
  );
}
