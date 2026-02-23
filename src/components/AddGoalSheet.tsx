import { useState } from 'react';
import { X, Trophy, Target, AlertCircle, CircleDot } from 'lucide-react';
import { GoalType } from '@/types/match';
import { PlayerAutocomplete } from './PlayerAutocomplete';

interface AddGoalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: (scorer: string, assist: string, type: GoalType) => void;
  knownPlayers: string[];
}

const goalTypes: { type: GoalType; label: string; icon: typeof Trophy }[] = [
  { type: 'normal', label: 'Normal', icon: Trophy },
  { type: 'head', label: 'Header', icon: CircleDot },
  { type: 'penalty', label: 'Penalty', icon: Target },
  { type: 'own-goal', label: 'Own Goal', icon: AlertCircle },
];

export function AddGoalSheet({ isOpen, onClose, onAddGoal, knownPlayers }: AddGoalSheetProps) {
  const [scorer, setScorer] = useState('');
  const [assist, setAssist] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('normal');

  const handleSubmit = () => {
    if (!scorer.trim()) return;
    onAddGoal(scorer.trim(), assist.trim(), goalType);
    setScorer('');
    setAssist('');
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Add Goal ⚽</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Scorer */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Scorer *</label>
            <PlayerAutocomplete
              value={scorer}
              onChange={setScorer}
              players={knownPlayers}
              placeholder="Who scored?"
              // autoFocus
            />
          </div>

          {/* Assist */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Assist (optional)
            </label>
            <PlayerAutocomplete
              value={assist}
              onChange={setAssist}
              players={knownPlayers}
              placeholder="Who assisted?"
            />
          </div>

          {/* Goal Type */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Goal Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {goalTypes.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setGoalType(type)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    goalType === type
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:border-primary/50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${goalType === type ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span
                    className={`text-[10px] font-medium ${goalType === type ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!scorer.trim()}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors btn-glow mt-2"
          >
            Add Goal
          </button>
        </div>
      </div>
    </div>
  );
}
