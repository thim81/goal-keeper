import { useEffect, useState } from 'react';
import { X, Play, Pause, ArrowLeft } from 'lucide-react';
import { GameEventType } from '@/types/match';
import { PlayerAutocomplete } from './PlayerAutocomplete';

interface AddEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (
    type: GameEventType,
    options?: { team?: 'my-team' | 'opponent'; player?: string },
  ) => void;
  myTeamName: string;
  opponentName: string;
  knownPlayers: string[];
}

const eventTypes: { type: GameEventType; label: string; icon: typeof Play; color: string }[] = [
  { type: 'pause', label: 'Pause Timer', icon: Pause, color: 'text-goal' },
  { type: 'resume', label: 'Resume Timer', icon: Play, color: 'text-primary' },
];

const cardEvents: { type: GameEventType; label: string; cardClassName: string }[] = [
  { type: 'yellow-card', label: 'Yellow Card', cardClassName: 'bg-yellow-400 border-yellow-500' },
  { type: 'red-card', label: 'Red Card', cardClassName: 'bg-red-500 border-red-600' },
] as const;

export function AddEventSheet({
  isOpen,
  onClose,
  onAddEvent,
  myTeamName,
  opponentName,
  knownPlayers,
}: AddEventSheetProps) {
  const [pendingCardType, setPendingCardType] = useState<'yellow-card' | 'red-card' | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'my-team' | 'opponent'>('my-team');
  const [player, setPlayer] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPendingCardType(null);
      setSelectedTeam('my-team');
      setPlayer('');
    }
  }, [isOpen]);

  const handleSelect = (type: GameEventType) => {
    if (type === 'yellow-card' || type === 'red-card') {
      setPendingCardType(type);
      return;
    }

    onAddEvent(type);
    onClose();
  };

  const handleAddCardEvent = () => {
    if (!pendingCardType) return;

    onAddEvent(pendingCardType, {
      team: selectedTeam,
      player: player.trim() || undefined,
    });
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

        {!pendingCardType && (
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

            {cardEvents.map(({ type, label, cardClassName }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelect(type)}
                className="flex items-center justify-center gap-3 px-2 py-4 bg-secondary rounded-xl hover:bg-secondary/80 transition-all active:scale-[0.98]"
                aria-label={label}
              >
                <span className={`inline-block h-5 w-4 rounded-[2px] border ${cardClassName}`} />
                <span className="font-semibold text-foreground">{label}</span>
              </button>
            ))}
          </div>
        )}

        {pendingCardType && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setPendingCardType(null)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-3">
              <span
                className={`inline-block h-5 w-4 rounded-[2px] border ${
                  pendingCardType === 'yellow-card'
                    ? 'bg-yellow-400 border-yellow-500'
                    : 'bg-red-500 border-red-600'
                }`}
              />
              <span className="font-semibold text-foreground">
                {pendingCardType === 'yellow-card' ? 'Yellow Card' : 'Red Card'}
              </span>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Team</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeam('my-team')}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    selectedTeam === 'my-team'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {myTeamName}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTeam('opponent')}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    selectedTeam === 'opponent'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {opponentName}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Player (optional)
              </label>
              <PlayerAutocomplete
                value={player}
                onChange={setPlayer}
                players={selectedTeam === 'my-team' ? knownPlayers : []}
                placeholder={selectedTeam === 'my-team' ? 'Which player?' : 'Opponent player name'}
              />
            </div>

            <button
              type="button"
              onClick={handleAddCardEvent}
              className="w-full py-3 bg-primary text-primary-foreground font-bold text-base rounded-xl hover:bg-primary/90 transition-colors btn-glow"
            >
              Add Card Event
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
