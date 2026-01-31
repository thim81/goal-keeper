import { X, Play, Pause, Clock, Flag } from 'lucide-react';
import { GameEventType } from '@/types/match';

interface AddEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (type: GameEventType) => void;
}

const eventTypes: { type: GameEventType; label: string; icon: typeof Play; color: string }[] = [
  { type: 'start', label: 'Start', icon: Play, color: 'text-primary' },
  { type: 'pause', label: 'Pause', icon: Pause, color: 'text-goal' },
  { type: 'resume', label: 'Resume', icon: Play, color: 'text-primary' },
  { type: 'half-time', label: 'Half Time', icon: Clock, color: 'text-muted-foreground' },
  { type: 'full-time', label: 'Full Time', icon: Flag, color: 'text-accent' },
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
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 safe-bottom animate-slide-up border-t border-border/50">
        {/* Handle */}
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />

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
        <div className="grid grid-cols-2 gap-3">
          {eventTypes.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className="flex items-center justify-center gap-3 p-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-all active:scale-[0.98]"
            >
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="font-semibold text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
