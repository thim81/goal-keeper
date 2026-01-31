import { X, Play, Pause, Clock, Flag } from 'lucide-react';
import { GameEventType } from '@/types/match';

interface AddEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (type: GameEventType) => void;
}

const eventTypes: { type: GameEventType; label: string; icon: typeof Play; color: string }[] = [
  { type: 'pause', label: 'Pause Timer', icon: Pause, color: 'text-goal' },
  { type: 'resume', label: 'Resume Timer', icon: Play, color: 'text-primary' },
];

export function AddEventSheet({ isOpen, onClose, onAddEvent }: AddEventSheetProps) {
  const handleSelect = (type: GameEventType) => {
    onAddEvent(type);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in mb-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/50 flex flex-col max-h-[92vh] animate-slide-up">
        {/* Handle */}
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto my-4 shrink-0" />

        <div className="flex-1 overflow-y-auto px-6 pb-10 safe-bottom">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Add Event 📋</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Event buttons */}
          <div className="flex flex-col gap-3">
            {eventTypes.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => handleSelect(type)}
                className="flex items-center justify-center gap-3 px-2 py-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-all active:scale-[0.98]"
              >
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="font-semibold text-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
